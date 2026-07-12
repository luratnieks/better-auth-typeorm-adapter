import { getAuthTables } from 'better-auth/db';
import type { BetterAuthOptions } from 'better-auth/types';
import {
  DataSource,
  EntitySchema,
  type EntitySchemaColumnOptions,
  type EntitySchemaIndexOptions,
} from 'typeorm';

/**
 * The Better Auth database schema, derived from the canonical
 * `getAuthTables` contract so no local mirror types (or casts) are needed.
 */
export type AuthTables = ReturnType<typeof getAuthTables>;

/** A single model definition from the Better Auth database schema. */
export type SchemaModel = AuthTables[string];

/** Field attributes as described by the Better Auth database schema. */
export type SchemaField = SchemaModel['fields'][string];

/**
 * Options accepted by {@link generateEntitySchemas}.
 */
export interface GenerateEntitySchemasOptions {
  /**
   * Use plural table names. Must match the `usePlural` value passed to
   * the adapter.
   *
   * @default false
   */
  usePlural?: boolean;
}

/**
 * The storage classification of a Better Auth field. This is the single
 * decision point shared by runtime `EntitySchema` generation and the
 * decorator-class code generator, so both always agree on column types.
 */
type FieldKind =
  | 'bigint'
  | 'number'
  | 'boolean'
  | 'date'
  | 'json'
  | 'string-array'
  | 'number-array'
  | 'varchar'
  | 'text';

/**
 * Classifies a Better Auth field into its storage kind. Unique or sortable
 * strings become `varchar` so they stay indexable on engines such as MySQL;
 * other strings use unbounded `text`.
 */
function classifyField(field: SchemaField): FieldKind {
  const type = Array.isArray(field.type) ? 'string' : field.type;
  switch (type) {
    case 'number':
      return field.bigint ? 'bigint' : 'number';
    case 'boolean':
      return 'boolean';
    case 'date':
      return 'date';
    case 'json':
      return 'json';
    case 'string[]':
      return 'string-array';
    case 'number[]':
      return 'number-array';
    default:
      return field.unique || field.sortable ? 'varchar' : 'text';
  }
}

/**
 * `EntitySchema` column type per field kind. Constructor types (`String`,
 * `Number`, ...) are normalized by TypeORM to a sensible column type for
 * the active driver.
 */
const ENTITY_SCHEMA_COLUMN_TYPES: Record<FieldKind, EntitySchemaColumnOptions['type']> = {
  bigint: 'bigint',
  number: Number,
  boolean: Boolean,
  date: Date,
  json: 'simple-json',
  'string-array': 'simple-json',
  'number-array': 'simple-json',
  varchar: String,
  text: 'text',
};

/** TypeScript property type emitted by the class code generator. */
const GENERATED_TS_TYPES: Record<FieldKind, string> = {
  bigint: 'number',
  number: 'number',
  boolean: 'boolean',
  date: 'Date',
  json: 'Record<string, unknown>',
  'string-array': 'string[]',
  'number-array': 'number[]',
  varchar: 'string',
  text: 'string',
};

/** Column type string emitted by the class code generator per field kind. */
const GENERATED_COLUMN_TYPES: Record<Exclude<FieldKind, 'date'>, string> = {
  bigint: 'bigint',
  number: 'integer',
  boolean: 'boolean',
  json: 'simple-json',
  'string-array': 'simple-json',
  'number-array': 'simple-json',
  varchar: 'varchar',
  text: 'text',
};

/**
 * Resolves the database column type used for `date` fields in generated
 * entity classes, based on the active TypeORM driver.
 */
function resolveDateColumnType(dataSource: DataSource): string {
  switch (dataSource.options.type) {
    case 'postgres':
    case 'cockroachdb':
      return 'timestamptz';
    case 'mssql':
      return 'datetime2';
    case 'mysql':
    case 'mariadb':
    case 'sqlite':
    case 'better-sqlite3':
    case 'sqljs':
    case 'capacitor':
    case 'cordova':
    case 'expo':
    case 'react-native':
      return 'datetime';
    default:
      return 'timestamp';
  }
}

/**
 * Builds TypeORM `EntitySchema` definitions for every table required by the
 * given Better Auth configuration, including tables added by plugins.
 *
 * This removes the need to hand-write entity classes: register the returned
 * schemas on the `DataSource` and the adapter can resolve every model.
 *
 * @example
 * ```ts
 * const betterAuthOptions = { plugins: [organization()] };
 * const dataSource = new DataSource({
 *   type: 'postgres',
 *   url: process.env.DATABASE_URL,
 *   entities: generateEntitySchemas(betterAuthOptions),
 * });
 * ```
 *
 * @param options - The same options object passed to `betterAuth()`.
 * @param config - Adapter-related generation options.
 * @returns One `EntitySchema` per Better Auth model.
 */
export function generateEntitySchemas(
  options: BetterAuthOptions,
  config: GenerateEntitySchemasOptions = {},
): EntitySchema[] {
  const tables = getAuthTables(options);
  const schemas: EntitySchema[] = [];

  for (const model of Object.values(tables)) {
    const tableName = config.usePlural ? `${model.modelName}s` : model.modelName;
    const columns: Record<string, EntitySchemaColumnOptions> = {
      id: { type: String, primary: true },
    };
    const indices: EntitySchemaIndexOptions[] = [];

    for (const [fieldKey, field] of Object.entries(model.fields)) {
      const columnName = field.fieldName || fieldKey;
      columns[columnName] = {
        type: ENTITY_SCHEMA_COLUMN_TYPES[classifyField(field)],
        nullable: !field.required,
        unique: !!field.unique,
      };
      if (field.index) {
        indices.push({ name: `${tableName}_${columnName}_idx`, columns: [columnName] });
      }
    }

    schemas.push(
      new EntitySchema({
        name: tableName,
        tableName,
        columns,
        indices,
      }),
    );
  }

  return schemas;
}

/**
 * Converts an arbitrary string to PascalCase (`two_factor` -> `TwoFactor`).
 */
function toPascalCase(value: string): string {
  return value
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

/**
 * Formats a schema `defaultValue` as a TypeORM `@Column({ default })`
 * expression, or returns `null` when no static default can be emitted.
 */
function formatDefaultValue(field: SchemaField): string | null {
  if (field.defaultValue === undefined) return null;
  if (typeof field.defaultValue === 'function') {
    const type = Array.isArray(field.type) ? field.type[0] : field.type;
    return type === 'date' ? `default: () => 'CURRENT_TIMESTAMP'` : null;
  }
  if (typeof field.defaultValue === 'string') {
    return `default: ${JSON.stringify(field.defaultValue)}`;
  }
  if (typeof field.defaultValue === 'number' || typeof field.defaultValue === 'boolean') {
    return `default: ${String(field.defaultValue)}`;
  }
  return null;
}

/**
 * Generates the decorator-based entity class source code for a single
 * Better Auth model. All classes are emitted into a single file, so
 * relations reference sibling classes without imports.
 */
function generateEntityClass(dataSource: DataSource, model: SchemaModel): string {
  const className = toPascalCase(model.modelName);
  const lines: string[] = [];

  lines.push(`@Entity('${model.modelName}')`);
  lines.push(`export class ${className} {`);
  lines.push(`  @PrimaryColumn('text')`);
  lines.push(`  id!: string;`);

  for (const [fieldKey, field] of Object.entries(model.fields)) {
    const columnName = field.fieldName || fieldKey;
    const kind = classifyField(field);
    const columnType =
      kind === 'date' ? resolveDateColumnType(dataSource) : GENERATED_COLUMN_TYPES[kind];
    const tsType = GENERATED_TS_TYPES[kind];

    const columnOptions: string[] = [];
    if (kind === 'varchar') columnOptions.push('length: 255');
    if (!field.required) columnOptions.push('nullable: true');
    if (field.unique) columnOptions.push('unique: true');
    const defaultValue = formatDefaultValue(field);
    if (defaultValue) columnOptions.push(defaultValue);

    const optionsSuffix = columnOptions.length > 0 ? `, { ${columnOptions.join(', ')} }` : '';

    lines.push('');
    if (field.index) {
      lines.push(`  @Index('${model.modelName}_${columnName}_idx')`);
    }
    lines.push(`  @Column('${columnType}'${optionsSuffix})`);
    lines.push(
      `  ${columnName}${field.required ? '!' : '?'}: ${tsType}${field.required ? '' : ' | null'};`,
    );

    if (field.references) {
      const relationClass = toPascalCase(field.references.model);
      const relationProperty = columnName.endsWith('Id')
        ? columnName.slice(0, -2)
        : `${columnName}Ref`;
      const onDelete = (field.references.onDelete || 'cascade').toUpperCase();
      lines.push('');
      lines.push(
        `  @ManyToOne(() => ${relationClass}, { onDelete: '${onDelete}', nullable: ${!field.required} })`,
      );
      lines.push(
        `  @JoinColumn({ name: '${columnName}', referencedColumnName: '${field.references.field}' })`,
      );
      lines.push(`  ${relationProperty}?: ${relationClass};`);
    }
  }

  lines.push('}');
  return lines.join('\n');
}

/**
 * Generates the full source of the entities file emitted by the Better Auth
 * CLI (`npx @better-auth/cli generate`): a header comment, the TypeORM
 * decorator imports actually used, and one entity class per model.
 */
export function generateEntitiesFileCode(dataSource: DataSource, tables: AuthTables): string {
  const models = Object.values(tables);

  const usesIndex = models.some((model) =>
    Object.values(model.fields).some((field) => field.index),
  );
  const usesRelations = models.some((model) =>
    Object.values(model.fields).some((field) => field.references),
  );

  const importedDecorators = ['Column', 'Entity', 'PrimaryColumn'];
  if (usesIndex) importedDecorators.push('Index');
  if (usesRelations) importedDecorators.push('JoinColumn', 'ManyToOne');

  const header =
    `import { ${importedDecorators.sort().join(', ')} } from 'typeorm';\n\n` +
    `/**\n` +
    ` * Better Auth entities generated by better-auth-typeorm-adapter.\n` +
    ` * Register these classes on your TypeORM DataSource.\n` +
    ` */\n`;

  const classes = models.map((model) => generateEntityClass(dataSource, model));

  return `${header}\n${classes.join('\n\n')}\n`;
}
