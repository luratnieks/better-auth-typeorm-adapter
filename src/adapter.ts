import { BetterAuthError } from 'better-auth';
import {
  createAdapterFactory,
  type CleanedWhere,
  type DBAdapterDebugLogOption,
} from 'better-auth/adapters';
import {
  And,
  DataSource,
  Equal,
  FindOperator,
  In,
  IsNull,
  LessThan,
  LessThanOrEqual,
  Like,
  MoreThan,
  MoreThanOrEqual,
  Not,
  Raw,
  type EntityMetadata,
  type EntityTarget,
  type FindOptionsWhere,
  type ObjectLiteral,
  type Repository,
} from 'typeorm';
import { generateEntitiesFileCode } from './schema.ts';

/**
 * Configuration accepted by {@link typeormAdapter}.
 */
export interface TypeORMAdapterConfig {
  /**
   * The TypeORM `DataSource` to run queries against.
   *
   * It does not need to be initialized upfront: the adapter lazily calls
   * `dataSource.initialize()` before the first operation when needed.
   */
  dataSource: DataSource;

  /**
   * Enable Better Auth adapter debug logs.
   *
   * @default false
   */
  debugLogs?: DBAdapterDebugLogOption;

  /**
   * Use plural table names (`users` instead of `user`).
   *
   * @default false
   */
  usePlural?: boolean;

  /**
   * Explicit mapping from Better Auth model names to TypeORM entities.
   *
   * Any model can be mapped, including models introduced by plugins
   * (`organization`, `passkey`, `twoFactor`, ...). When a model is not
   * mapped here, the adapter resolves the entity registered on the
   * `DataSource` whose name or table name matches the model name.
   *
   * @example
   * ```ts
   * typeormAdapter({
   *   dataSource,
   *   entities: { user: MyUser, session: MySession, organization: MyOrg },
   * });
   * ```
   */
  entities?: Record<string, EntityTarget<ObjectLiteral>>;

  /**
   * Model names that should be soft deleted instead of hard deleted.
   *
   * The mapped entity must declare a `@DeleteDateColumn()`; otherwise the
   * adapter throws a `BetterAuthError` when a delete is attempted.
   */
  softDeleteEnabledEntities?: string[];
}

/**
 * Lazily-built lookup from Better Auth field names (property or database
 * column names) to entity property names, cached per entity metadata.
 */
const propertyNameCache = new WeakMap<EntityMetadata, Map<string, string>>();

/**
 * Maps a Better Auth field name to the entity property name, accepting
 * either the property name itself or the database column name. Property
 * names win over column names when both exist.
 */
function toPropertyName(repository: Repository<ObjectLiteral>, field: string): string {
  const { metadata } = repository;
  let lookup = propertyNameCache.get(metadata);
  if (!lookup) {
    lookup = new Map<string, string>();
    for (const column of metadata.columns) {
      if (!lookup.has(column.databaseName)) {
        lookup.set(column.databaseName, column.propertyName);
      }
    }
    for (const column of metadata.columns) {
      lookup.set(column.propertyName, column.propertyName);
    }
    propertyNameCache.set(metadata, lookup);
  }
  return lookup.get(field) ?? field;
}

/**
 * Remaps the keys of an input payload to entity property names, dropping
 * `undefined` values.
 */
function mapDataKeys(
  repository: Repository<ObjectLiteral>,
  data: Record<string, unknown>,
): Record<string, unknown> {
  const mapped: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    mapped[toPropertyName(repository, key)] = value;
  }
  return mapped;
}

/**
 * TypeORM adapter for Better Auth.
 *
 * Implements every Better Auth adapter operation on top of TypeORM's
 * repository API, so entity hooks, transformers and naming strategies
 * configured by the application keep working. Supports every `where`
 * operator (`eq`, `ne`, `lt`, `lte`, `gt`, `gte`, `in`, `not_in`,
 * `contains`, `starts_with`, `ends_with`), `OR` connectors and
 * case-insensitive comparisons.
 *
 * @example
 * ```ts
 * import { betterAuth } from 'better-auth';
 * import { typeormAdapter } from 'better-auth-typeorm-adapter';
 * import { AppDataSource } from './data-source';
 *
 * export const auth = betterAuth({
 *   database: typeormAdapter({ dataSource: AppDataSource }),
 * });
 * ```
 *
 * @param config - Adapter configuration.
 * @returns A Better Auth database adapter factory.
 */
export const typeormAdapter = (config: TypeORMAdapterConfig) => {
  const {
    dataSource,
    debugLogs = false,
    usePlural = false,
    entities = {},
    softDeleteEnabledEntities = [],
  } = config;

  return createAdapterFactory({
    config: {
      adapterId: 'typeorm-adapter',
      adapterName: 'TypeORM Adapter',
      usePlural,
      debugLogs,
      supportsJSON: true,
      supportsDates: true,
      supportsBooleans: true,
      supportsNumericIds: false,
      transaction: false,
    },

    adapter: ({ getDefaultModelName, getFieldName, debugLog }) => {
      /** Monotonic counter that keeps `Raw()` parameter names unique per query. */
      let rawParamIndex = 0;

      /** In-flight initialization, memoized so concurrent cold starts share it. */
      let initializing: Promise<DataSource> | undefined;

      /**
       * Ensures the `DataSource` is ready, initializing it on first use.
       * Concurrent callers await the same initialization; a failed attempt
       * is cleared so the next call can retry.
       */
      const ensureDataSource = (): Promise<DataSource> => {
        if (dataSource.isInitialized) return Promise.resolve(dataSource);
        initializing ??= dataSource.initialize().catch((error) => {
          initializing = undefined;
          throw error;
        });
        return initializing;
      };

      /**
       * Resolves the TypeORM repository for a Better Auth model.
       *
       * Resolution order: the explicit `entities` mapping (keyed by default
       * or effective model name), then any entity registered on the
       * `DataSource` whose name or table name matches the model name.
       *
       * @throws BetterAuthError when no entity can be resolved.
       */
      const getRepository = async (model: string): Promise<Repository<ObjectLiteral>> => {
        await ensureDataSource();

        const mapped = entities[getDefaultModelName(model)] ?? entities[model];
        if (mapped) {
          return dataSource.getRepository(mapped);
        }

        const metadata = dataSource.entityMetadatas.find(
          (meta) =>
            meta.tableName === model ||
            meta.name === model ||
            meta.targetName === model ||
            meta.tableName.toLowerCase() === model.toLowerCase() ||
            meta.name.toLowerCase() === model.toLowerCase(),
        );
        if (!metadata) {
          throw new BetterAuthError(
            `[TypeORM Adapter] No entity found for model "${model}". ` +
              `Register an entity for it on the DataSource (see generateEntitySchemas) ` +
              `or map it through the "entities" adapter option.`,
          );
        }
        return dataSource.getRepository(metadata.target);
      };

      /**
       * Builds a case-insensitive `FindOperator` using `LOWER()` on both the
       * column and the parameter, which works across every supported driver.
       */
      const insensitiveOperator = (operator: CleanedWhere['operator'], value: unknown) => {
        const parameter = `ba_ci_${rawParamIndex++}`;
        const lowered = (input: unknown): unknown =>
          typeof input === 'string' ? input.toLowerCase() : input;

        switch (operator) {
          case 'ne':
            return Raw((column) => `LOWER(${column}) <> :${parameter}`, {
              [parameter]: lowered(value),
            });
          case 'contains':
            return Raw((column) => `LOWER(${column}) LIKE :${parameter}`, {
              [parameter]: `%${lowered(value)}%`,
            });
          case 'starts_with':
            return Raw((column) => `LOWER(${column}) LIKE :${parameter}`, {
              [parameter]: `${lowered(value)}%`,
            });
          case 'ends_with':
            return Raw((column) => `LOWER(${column}) LIKE :${parameter}`, {
              [parameter]: `%${lowered(value)}`,
            });
          case 'in':
            return Raw((column) => `LOWER(${column}) IN (:...${parameter})`, {
              [parameter]: (value as unknown[]).map(lowered),
            });
          case 'not_in':
            return Raw((column) => `LOWER(${column}) NOT IN (:...${parameter})`, {
              [parameter]: (value as unknown[]).map(lowered),
            });
          default:
            return Raw((column) => `LOWER(${column}) = :${parameter}`, {
              [parameter]: lowered(value),
            });
        }
      };

      /**
       * Converts a single cleaned `where` condition to a TypeORM find value
       * (raw value or `FindOperator`).
       */
      const toFindValue = (condition: CleanedWhere): unknown => {
        const { operator, value, mode } = condition;

        const isStringComparison =
          typeof value === 'string' ||
          (Array.isArray(value) && value.every((entry) => typeof entry === 'string'));
        if (mode === 'insensitive' && isStringComparison && value !== null) {
          return insensitiveOperator(operator, value);
        }

        switch (operator) {
          case 'ne':
            return value === null ? Not(IsNull()) : Not(value);
          case 'lt':
            return LessThan(value);
          case 'lte':
            return LessThanOrEqual(value);
          case 'gt':
            return MoreThan(value);
          case 'gte':
            return MoreThanOrEqual(value);
          case 'in': {
            const values = Array.isArray(value) ? value : [value];
            return values.length === 0 ? Raw(() => '1 = 0') : In(values);
          }
          case 'not_in': {
            const values = Array.isArray(value) ? value : [value];
            return values.length === 0 ? Raw(() => '1 = 1') : Not(In(values));
          }
          case 'contains':
            return Like(`%${value}%`);
          case 'starts_with':
            return Like(`${value}%`);
          case 'ends_with':
            return Like(`%${value}`);
          default:
            return value === null ? IsNull() : value;
        }
      };

      /**
       * Wraps a find value in a `FindOperator` so it can participate in an
       * `And(...)` composition.
       */
      const asOperator = (value: unknown): FindOperator<unknown> => {
        if (value instanceof FindOperator) return value;
        return value === null ? IsNull() : Equal(value);
      };

      /**
       * Sets a condition on a where group, combining with `And(...)` when the
       * field already has a condition instead of overwriting it.
       */
      const mergeCondition = (
        group: Record<string, unknown>,
        property: string,
        value: unknown,
      ): void => {
        group[property] =
          property in group ? And(asOperator(group[property]), asOperator(value)) : value;
      };

      /**
       * Converts a cleaned `where` clause to TypeORM `FindOptionsWhere`.
       *
       * Conditions with the `AND` connector form a base group; each `OR`
       * condition produces an additional branch combined with the base group,
       * matching Better Auth semantics: `(AND...) AND (or1 OR or2 ...)`.
       * Repeated fields within a group are merged with `And(...)`.
       */
      const buildWhere = (
        repository: Repository<ObjectLiteral>,
        where?: CleanedWhere[],
      ): FindOptionsWhere<ObjectLiteral> | FindOptionsWhere<ObjectLiteral>[] => {
        if (!where || where.length === 0) return {};

        const andConditions = where.filter((condition) => condition.connector !== 'OR');
        const orConditions = where.filter((condition) => condition.connector === 'OR');

        const base: Record<string, unknown> = {};
        for (const condition of andConditions) {
          mergeCondition(base, toPropertyName(repository, condition.field), toFindValue(condition));
        }

        if (orConditions.length === 0) return base as FindOptionsWhere<ObjectLiteral>;

        return orConditions.map((condition) => {
          const branch: Record<string, unknown> = { ...base };
          mergeCondition(
            branch,
            toPropertyName(repository, condition.field),
            toFindValue(condition),
          );
          return branch as FindOptionsWhere<ObjectLiteral>;
        });
      };

      /**
       * Maps a possibly-default field name through the Better Auth schema
       * (`getFieldName`) and then to the entity property name. Unlike `where`
       * clauses, `select` and `sortBy` reach the adapter untransformed.
       */
      const resolveField = (
        repository: Repository<ObjectLiteral>,
        model: string,
        field: string,
      ): string => {
        let mapped = field;
        try {
          mapped = getFieldName({ model, field });
        } catch {
          // Field not present in the Better Auth schema; use it as-is.
        }
        return toPropertyName(repository, mapped);
      };

      /**
       * Builds a TypeORM select object from a Better Auth `select` array.
       * Only the requested columns are fetched and returned.
       */
      const buildSelect = (
        repository: Repository<ObjectLiteral>,
        model: string,
        select?: string[],
      ): Record<string, boolean> | undefined => {
        if (!select || select.length === 0) return undefined;
        const selection: Record<string, boolean> = {};
        for (const field of select) {
          selection[resolveField(repository, model, field)] = true;
        }
        return selection;
      };

      /**
       * Returns whether the model is configured for soft deletion, validating
       * that the entity declares a delete-date column.
       *
       * @throws BetterAuthError when soft delete is enabled but unsupported.
       */
      const isSoftDelete = (model: string, repository: Repository<ObjectLiteral>): boolean => {
        const enabled =
          softDeleteEnabledEntities.includes(model) ||
          softDeleteEnabledEntities.includes(getDefaultModelName(model));
        if (!enabled) return false;
        if (!repository.metadata.deleteDateColumn) {
          throw new BetterAuthError(
            `[TypeORM Adapter] Soft delete is enabled for "${model}" but its entity ` +
              `has no @DeleteDateColumn().`,
          );
        }
        return true;
      };

      /**
       * Logs and executes an adapter operation, surfacing failures as
       * `BetterAuthError` with the model and operation in the message.
       */
      const run = async <T>(
        operation: string,
        model: string,
        args: Record<string, unknown>,
        fn: () => Promise<T>,
      ): Promise<T> => {
        debugLog(operation, { model, ...args });
        try {
          return await fn();
        } catch (error) {
          if (error instanceof BetterAuthError) throw error;
          throw new BetterAuthError(
            `[TypeORM Adapter] Failed to ${operation} "${model}": ` +
              `${error instanceof Error ? error.message : String(error)}`,
          );
        }
      };

      return {
        /**
         * Inserts a record through `repository.save`, so `@BeforeInsert`
         * hooks and column transformers run.
         */
        create: async <T extends Record<string, unknown>>({
          model,
          data,
        }: {
          model: string;
          data: T;
          select?: string[];
        }): Promise<T> =>
          run('create', model, { data }, async () => {
            const repository = await getRepository(model);
            const entity = repository.create(mapDataKeys(repository, data));
            return (await repository.save(entity)) as T;
          }),

        /**
         * Updates the single record matching `where`. Returns `null` when no
         * record matches. The write targets the primary key of the matched
         * row, so broad `where` clauses never fan out to multiple rows.
         */
        update: async <T>({
          model,
          where,
          update,
        }: {
          model: string;
          where: CleanedWhere[];
          update: T;
        }): Promise<T | null> =>
          run('update', model, { where, update }, async () => {
            const repository = await getRepository(model);
            const existing = await repository.findOne({ where: buildWhere(repository, where) });
            if (!existing) return null;
            repository.merge(existing, mapDataKeys(repository, update as Record<string, unknown>));
            return (await repository.save(existing)) as T;
          }),

        /**
         * Updates every record matching `where` and returns the affected
         * count. Uses `save` so update hooks run per entity.
         */
        updateMany: async ({ model, where, update }) =>
          run('updateMany', model, { where, update }, async () => {
            const repository = await getRepository(model);
            const rows = await repository.find({ where: buildWhere(repository, where) });
            if (rows.length === 0) return 0;
            const mapped = mapDataKeys(repository, update as Record<string, unknown>);
            for (const row of rows) {
              repository.merge(row, mapped);
            }
            await repository.save(rows);
            return rows.length;
          }),

        /**
         * Deletes the single record matching `where`, honoring soft delete
         * configuration. Missing records are a no-op.
         */
        delete: async ({ model, where }) => {
          await run('delete', model, { where }, async () => {
            const repository = await getRepository(model);
            const existing = await repository.findOne({ where: buildWhere(repository, where) });
            if (!existing) return;
            if (isSoftDelete(model, repository)) {
              await repository.softRemove(existing);
            } else {
              await repository.remove(existing);
            }
          });
        },

        /**
         * Deletes every record matching `where` and returns the affected
         * count, honoring soft delete configuration.
         */
        deleteMany: async ({ model, where }) =>
          run('deleteMany', model, { where }, async () => {
            const repository = await getRepository(model);
            const rows = await repository.find({ where: buildWhere(repository, where) });
            if (rows.length === 0) return 0;
            const count = rows.length;
            if (isSoftDelete(model, repository)) {
              await repository.softRemove(rows);
            } else {
              await repository.remove(rows);
            }
            return count;
          }),

        /**
         * Finds the first record matching `where`, optionally narrowing the
         * selected columns.
         */
        findOne: async <T>({
          model,
          where,
          select,
        }: {
          model: string;
          where: CleanedWhere[];
          select?: string[];
        }): Promise<T | null> =>
          run('findOne', model, { where, select }, async () => {
            const repository = await getRepository(model);
            const row = await repository.findOne({
              where: buildWhere(repository, where),
              select: buildSelect(repository, model, select),
            });
            return (row ?? null) as T | null;
          }),

        /**
         * Finds records matching `where` with sorting and pagination.
         */
        findMany: async <T>({
          model,
          where,
          limit,
          sortBy,
          offset,
          select,
        }: {
          model: string;
          where?: CleanedWhere[];
          limit: number;
          sortBy?: { field: string; direction: 'asc' | 'desc' };
          offset?: number;
          select?: string[];
        }): Promise<T[]> =>
          run('findMany', model, { where, limit, sortBy, offset, select }, async () => {
            const repository = await getRepository(model);
            const rows = await repository.find({
              where: buildWhere(repository, where),
              select: buildSelect(repository, model, select),
              order: sortBy
                ? {
                    [resolveField(repository, model, sortBy.field)]:
                      sortBy.direction === 'desc' ? 'DESC' : 'ASC',
                  }
                : undefined,
              take: limit,
              skip: offset || undefined,
            });
            return rows as T[];
          }),

        /**
         * Counts records matching `where`.
         */
        count: async ({ model, where }) =>
          run('count', model, { where }, async () => {
            const repository = await getRepository(model);
            return repository.count({ where: buildWhere(repository, where) });
          }),

        /**
         * Generates decorator-based TypeORM entity classes for the Better
         * Auth schema, following the CLI contract (`npx @better-auth/cli
         * generate`): the generated source is returned as `{ code, path }`
         * and written by the CLI, not by the adapter.
         */
        createSchema: async ({ file, tables }) => ({
          code: generateEntitiesFileCode(dataSource, tables),
          path: file ?? 'auth-entities.ts',
          overwrite: true,
        }),

        options: config,
      };
    },
  });
};
