import { createAdapterFactory, type DBAdapterDebugLogOption } from 'better-auth/adapters';
import { DataSource, Repository, EntityTarget, ObjectLiteral, DeepPartial } from 'typeorm';
import { promises as fs } from 'fs';
import { join } from 'path';

/**
 * TypeORM adapter configuration for Better Auth
 */
export interface TypeORMAdapterConfig {
  /**
   * TypeORM DataSource (must be initialized)
   */
  dataSource: DataSource;

  /**
   * Debug logs for troubleshooting
   */
  debugLogs?: DBAdapterDebugLogOption;

  /**
   * Whether table names should be plural
   * @default false
   */
  usePlural?: boolean;

  /**
   * Custom entity mappings
   * Map Better Auth model names to your TypeORM entities
   *
   * @example
   * ```ts
   * {
   *   user: MyUserEntity,
   *   session: MySessionEntity,
   *   account: MyAccountEntity,
   *   verification: MyVerificationEntity
   * }
   * ```
   */
  entities?: {
    user?: EntityTarget<ObjectLiteral>;
    account?: EntityTarget<ObjectLiteral>;
    session?: EntityTarget<ObjectLiteral>;
    verification?: EntityTarget<ObjectLiteral>;
  };
}

/**
 * TypeORM Adapter for Better Auth
 *
 * This adapter implements all necessary Better Auth operations
 * using TypeORM as the ORM for PostgreSQL/MySQL/SQLite/etc.
 *
 * @example
 * ```ts
 * import { typeormAdapter } from 'better-auth-typeorm-adapter';
 * import { betterAuth } from 'better-auth';
 * import { AppDataSource } from './data-source';
 *
 * // Initialize DataSource first
 * await AppDataSource.initialize();
 *
 * const auth = betterAuth({
 *   database: typeormAdapter({
 *     dataSource: AppDataSource,
 *   }),
 * });
 * ```
 *
 * @param config - Adapter configuration
 * @returns Better Auth adapter instance
 */
export const typeormAdapter = (config: TypeORMAdapterConfig) => {
  const { dataSource, debugLogs = false, usePlural = false, entities = {} } = config;

  /**
   * Maps Better Auth model names to TypeORM entities
   */
  const getEntity = (model: string): EntityTarget<ObjectLiteral> => {
    // Use custom entities if provided
    if (entities[model as keyof typeof entities]) {
      return entities[model as keyof typeof entities]!;
    }

    // Default: use model name as entity name
    return model as any;
  };

  /**
   * Gets TypeORM repository for the model
   */
  const getRepository = (model: string): Repository<any> => {
    const entity = getEntity(model);
    return dataSource.getRepository(entity);
  };

  /**
   * Converts Better Auth where clause to TypeORM format
   * Better Auth passes where as: [{ field: 'email', value: 'test@test.com', operator: 'eq' }]
   * or as simple array: ['email', 'test@test.com']
   */
  const buildWhereClause = (where: any[]): Record<string, any> => {
    const whereObj: Record<string, any> = {};

    if (!where || where.length === 0) {
      return whereObj;
    }

    // If array of objects (new Better Auth format)
    if (typeof where[0] === 'object' && where[0].field) {
      for (const condition of where) {
        whereObj[condition.field] = condition.value;
      }
      return whereObj;
    }

    // If simple alternating array [field, value, field, value]
    for (let i = 0; i < where.length; i += 2) {
      const field = where[i];
      const value = where[i + 1];
      if (field && value !== undefined) {
        whereObj[field] = value;
      }
    }

    return whereObj;
  };

  return createAdapterFactory({
    config: {
      adapterId: 'typeorm-adapter',
      adapterName: 'TypeORM Adapter',
      usePlural,
      debugLogs,
      supportsJSON: true,
      supportsDates: true,
      supportsBooleans: true,
      supportsNumericIds: false, // Using UUID
      transaction: false, // TypeORM transactions not implemented yet
    },

    adapter: ({ options, schema, debugLog }) => {
      return {
        /**
         * Creates a new record
         */
        create: async ({ model, data, select }) => {
          debugLog?.('create', { model, data, select });

          const repository = getRepository(model);

          // If ID is provided by Better Auth, use it
          // Otherwise, PostgreSQL will generate UUID automatically via @PrimaryGeneratedColumn
          const entity = repository.create(data as DeepPartial<any>);
          const result = await repository.save(entity);

          return result;
        },

        /**
         * Updates a record
         */
        update: async ({ model, where, update }) => {
          debugLog?.('update', { model, where, update });

          const repository = getRepository(model);
          const whereClause = buildWhereClause(where);

          // Find existing record
          const existing = await repository.findOne({ where: whereClause });
          if (!existing) {
            throw new Error(`Record not found in ${model}`);
          }

          // Update
          await repository.update(whereClause, update as any);

          // Return updated record
          const updated = await repository.findOne({ where: whereClause });
          return updated;
        },

        /**
         * Updates multiple records
         */
        updateMany: async ({ model, where, update }) => {
          debugLog?.('updateMany', { model, where, update });

          const repository = getRepository(model);
          const whereClause = buildWhereClause(where);

          const result = await repository.update(whereClause, update as any);
          return result.affected || 0;
        },

        /**
         * Deletes a record
         */
        delete: async ({ model, where }) => {
          debugLog?.('delete', { model, where });

          const repository = getRepository(model);
          const whereClause = buildWhereClause(where);

          await repository.delete(whereClause);
        },

        /**
         * Deletes multiple records
         */
        deleteMany: async ({ model, where }) => {
          debugLog?.('deleteMany', { model, where });

          const repository = getRepository(model);
          const whereClause = buildWhereClause(where);

          const result = await repository.delete(whereClause);
          return result.affected || 0;
        },

        /**
         * Finds a single record
         */
        findOne: async ({ model, where, select }) => {
          debugLog?.('findOne', { model, where, select });

          const repository = getRepository(model);
          const whereClause = buildWhereClause(where);

          // Use a simple alias to avoid syntax issues
          const alias = 'entity';
          const query = repository.createQueryBuilder(alias);

          // Apply where filters
          Object.entries(whereClause).forEach(([key, value], index) => {
            const paramName = `param${index}`;
            if (index === 0) {
              query.where(`${alias}.${key} = :${paramName}`, { [paramName]: value });
            } else {
              query.andWhere(`${alias}.${key} = :${paramName}`, { [paramName]: value });
            }
          });

          // Apply select if provided
          if (select && select.length > 0) {
            const selectFields = select.map((field) => `${alias}.${field}`);
            query.select(selectFields);
          }

          const result = await query.getOne();
          return result;
        },

        /**
         * Finds multiple records
         */
        findMany: async ({ model, where, limit, sortBy, offset }) => {
          debugLog?.('findMany', { model, where, limit, sortBy, offset });

          const repository = getRepository(model);
          const alias = 'entity';
          const query = repository.createQueryBuilder(alias);

          // Apply where if provided
          if (where && where.length > 0) {
            const whereClause = buildWhereClause(where);
            Object.entries(whereClause).forEach(([key, value], index) => {
              const paramName = `param${index}`;
              if (index === 0) {
                query.where(`${alias}.${key} = :${paramName}`, { [paramName]: value });
              } else {
                query.andWhere(`${alias}.${key} = :${paramName}`, { [paramName]: value });
              }
            });
          }

          // Apply limit
          if (limit) {
            query.limit(limit);
          }

          // Apply offset
          if (offset) {
            query.offset(offset);
          }

          // Apply sorting
          if (sortBy) {
            const { field, direction } = sortBy;
            query.orderBy(`${alias}.${field}`, direction === 'asc' ? 'ASC' : 'DESC');
          }

          const results = await query.getMany();
          return results;
        },

        /**
         * Counts records
         */
        count: async ({ model, where }) => {
          debugLog?.('count', { model, where });

          const repository = getRepository(model);

          if (!where || where.length === 0) {
            return await repository.count();
          }

          const whereClause = buildWhereClause(where);
          return await repository.count({ where: whereClause });
        },

        /**
         * Adapter options (exposes configuration)
         */
        options: config,
      };
    },

    /**
     * Creates TypeORM entity files for Better Auth schema
     */
    // @ts-ignore - createSchema is supported but types may not be updated
    createSchema: async ({ file, tables }: { file?: string; tables: Record<string, any> }) => {
      const outputDir = file || './src/entities';

      // Create output directory
      await fs.mkdir(outputDir, { recursive: true });

      // Generate entity files
      const entityNames: string[] = [];

      for (const [tableName, tableSchema] of Object.entries(tables)) {
        const entityContent = generateEntityFile(tableName, tableSchema);
        const fileName = `${tableName}.entity.ts`;
        const filePath = join(outputDir, fileName);

        await fs.writeFile(filePath, entityContent, 'utf-8');
        entityNames.push(tableName);

        process.stdout.write(`✓ Generated ${fileName}\n`);
      }

      // Generate index.ts for exports
      const indexContent = generateIndexFile(entityNames);
      await fs.writeFile(join(outputDir, 'index.ts'), indexContent, 'utf-8');

      process.stdout.write(`✓ Generated index.ts\n`);
      process.stdout.write(`\nEntities created successfully in ${outputDir}\n`);
    },
  });
};

/**
 * Generates TypeORM entity file content
 */
function generateEntityFile(tableName: string, tableSchema: any): string {
  const className = toPascalCase(tableName);
  const imports = new Set<string>([
    'Entity',
    'PrimaryGeneratedColumn',
    'Column',
    'CreateDateColumn',
    'UpdateDateColumn',
  ]);

  const fields: string[] = [];
  const relationships: string[] = [];
  const relationshipImports = new Set<string>();

  // Process each field
  for (const [fieldName, fieldSchema] of Object.entries(tableSchema.fields || {})) {
    const field: any = fieldSchema;

    // Skip if it's a relationship field (will be handled separately)
    if (fieldName === 'id') {
      fields.push(`  @PrimaryGeneratedColumn('uuid')\n  id: string;`);
      continue;
    }

    if (fieldName === 'createdAt') {
      fields.push(`  @CreateDateColumn()\n  createdAt: Date;`);
      continue;
    }

    if (fieldName === 'updatedAt') {
      fields.push(`  @UpdateDateColumn()\n  updatedAt: Date;`);
      continue;
    }

    // Handle foreign keys
    if (fieldName.endsWith('Id') && fieldName !== 'accountId' && fieldName !== 'providerId') {
      fields.push(`  @Column({ type: 'uuid' })\n  ${fieldName}: string;`);

      // Add relationship
      const relatedEntity = toPascalCase(fieldName.replace('Id', ''));
      const relationshipName = fieldName.replace('Id', '');

      imports.add('ManyToOne');
      imports.add('JoinColumn');
      relationshipImports.add(relatedEntity);

      relationships.push(
        `  @ManyToOne(() => ${relatedEntity}, { onDelete: 'CASCADE' })\n` +
          `  @JoinColumn({ name: '${fieldName}' })\n` +
          `  ${relationshipName}?: ${relatedEntity};`,
      );
      continue;
    }

    // Regular fields
    const columnDef = generateColumnDefinition(fieldName, field);
    fields.push(columnDef);
  }

  // Build imports
  const typeormImports = Array.from(imports).join(', ');
  let importStatements = `import { ${typeormImports} } from 'typeorm';`;

  if (relationshipImports.size > 0) {
    importStatements +=
      '\n' +
      Array.from(relationshipImports)
        .map((entity) => `import { ${entity} } from './${entity.toLowerCase()}.entity';`)
        .join('\n');
  }

  // Build class
  const allFields = [...fields, ...relationships].join('\n\n');

  return `${importStatements}

@Entity('${tableName}')
export class ${className} {
${allFields}
}
`;
}

/**
 * Generates column definition for a field
 */
function generateColumnDefinition(fieldName: string, field: any): string {
  const options: string[] = [];
  let columnType = 'varchar';

  // Determine column type
  if (field.type === 'string') {
    if (
      fieldName === 'token' ||
      fieldName === 'accessToken' ||
      fieldName === 'refreshToken' ||
      fieldName === 'idToken'
    ) {
      columnType = 'text';
    } else if (fieldName === 'userAgent') {
      columnType = 'text';
    } else {
      columnType = 'varchar';
      if (!fieldName.includes('Token')) {
        options.push('length: 255');
      }
    }
  } else if (field.type === 'boolean') {
    columnType = 'boolean';
    if (field.defaultValue !== undefined) {
      options.push(`default: ${field.defaultValue}`);
    }
  } else if (field.type === 'number') {
    columnType = 'integer';
  } else if (field.type === 'date' || field.type === 'Date') {
    columnType = 'timestamp';
  }

  options.unshift(`type: '${columnType}'`);

  // Handle unique constraint
  if (fieldName === 'email' || fieldName === 'token') {
    options.push('unique: true');
  }

  // Handle nullable
  if (!field.required || field.isOptional) {
    options.push('nullable: true');
  }

  const optionsStr = options.length > 0 ? `{ ${options.join(', ')} }` : '';
  const optional = !field.required || field.isOptional ? '?' : '';

  return `  @Column(${optionsStr})\n  ${fieldName}${optional}: ${getTypeScriptType(field.type)};`;
}

/**
 * Converts Better Auth type to TypeScript type
 */
function getTypeScriptType(type: string): string {
  switch (type) {
    case 'string':
      return 'string';
    case 'boolean':
      return 'boolean';
    case 'number':
      return 'number';
    case 'date':
    case 'Date':
      return 'Date';
    default:
      return 'string';
  }
}

/**
 * Generates index.ts file content
 */
function generateIndexFile(entityNames: string[]): string {
  const exports = entityNames
    .map((name) => {
      const className = toPascalCase(name);
      return `export { ${className} } from './${name}.entity';`;
    })
    .join('\n');

  return `${exports}\n`;
}

/**
 * Converts string to PascalCase
 */
function toPascalCase(str: string): string {
  return str
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

export default typeormAdapter;
