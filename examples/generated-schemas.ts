/**
 * Generated Entity Schemas Example (recommended)
 *
 * Instead of hand-writing entity classes, derive every table (including
 * plugin tables) from your Better Auth options with `generateEntitySchemas`.
 */

import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { typeormAdapter, generateEntitySchemas } from 'better-auth-typeorm-adapter';
import { DataSource } from 'typeorm';

// 1. Define your Better Auth options first — the schema is derived from them.
const betterAuthOptions = {
  emailAndPassword: {
    enabled: true,
  },
  // plugins: [organization(), twoFactor()], // plugin tables are generated too
} satisfies BetterAuthOptions;

// 2. Register the generated schemas on the DataSource.
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  username: 'postgres',
  password: 'postgres',
  database: 'myapp',
  synchronize: false, // Use migrations in production!
  entities: generateEntitySchemas(betterAuthOptions),
});

// 3. Create the Better Auth instance. The adapter initializes the
//    DataSource lazily, so no explicit initialize() call is required.
export const auth = betterAuth({
  ...betterAuthOptions,
  database: typeormAdapter({
    dataSource: AppDataSource,
  }),
});

export type Auth = typeof auth;
