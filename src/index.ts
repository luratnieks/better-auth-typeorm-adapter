/**
 * better-auth-typeorm-adapter
 *
 * TypeORM adapter for Better Auth, plus schema helpers:
 * - {@link typeormAdapter} - the database adapter itself.
 * - {@link generateEntitySchemas} - runtime `EntitySchema` definitions
 *   derived from Better Auth options (no hand-written entities needed).
 */
export { typeormAdapter, type TypeORMAdapterConfig } from './adapter.ts';
export { generateEntitySchemas, type GenerateEntitySchemasOptions } from './schema.ts';

import { typeormAdapter } from './adapter.ts';

export default typeormAdapter;
