# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.1] - 2026-09-24

### Fixed

- `findOne` now returns a plain row snapshot. Better Auth 1.7 rejects TypeORM entity instances when reading a row for `incrementOne` and `consumeOne` (`Adapter must return a row snapshot or null`)
- Native `incrementOne` and `consumeOne`. Better Auth 1.7 uses them for OTP consumption, two-factor counters and rate limits. Postgres and MySQL lock the row inside a transaction; other drivers run the same write in a transaction without `SELECT ... FOR UPDATE`

## [1.2.0] - 2026-07-12

### Added

- Full `where` operator support: `ne`, `lt`, `lte`, `gt`, `gte`, `in`, `not_in`, `contains`, `starts_with`, `ends_with` (previously every operator collapsed to equality)
- `OR` connector support in `where` clauses
- Case-insensitive matching (`mode: 'insensitive'`) via `LOWER()` across all drivers
- `generateEntitySchemas(options)` - builds TypeORM `EntitySchema` definitions for every Better Auth model (core + plugins) so no hand-written entities are required
- Plugin model support: the `entities` option now accepts any model name, and unmapped models resolve by entity/table name on the DataSource
- Optional soft delete per model via `softDeleteEnabledEntities` (requires `@DeleteDateColumn`)
- Lazy `DataSource` initialization on first use
- Official `@better-auth/test-utils` adapter test suites (normal, auth flows, transactions, UUID, case-insensitive) running on CI
- Regression test suite on the built-in Node.js test runner (`npm run test:unit`)
- GitHub Actions CI (typecheck, build, tests on Node 22/24)
- Dual ESM + CJS build via tsup with an `exports` map

### Changed

- `update` now returns `null` when no record matches (previously threw an error) and always writes by primary key, so broad `where` clauses never update multiple rows
- `select` and `sortBy` fields are mapped through the Better Auth schema (`fieldName`) and entity metadata (property or column name)
- `createSchema` now follows the Better Auth CLI contract, returning `{ code, path }` instead of writing files directly, and generates entities with `@PrimaryColumn('text')`, relations derived from schema `references`, `simple-json` columns for JSON fields and driver-appropriate date column types
- All errors are wrapped in `BetterAuthError` with the model and operation in the message
- Requires `better-auth >= 1.6` and Node.js `>= 20.19`

### Fixed

- Expired session/verification cleanup (queries using `lt`/`gte`) matched nothing because operators were ignored
- Admin plugin searches (`contains`) behaved as exact matches
- Generated entities used `@PrimaryGeneratedColumn('uuid')`, which rejected Better Auth's non-UUID string IDs on PostgreSQL

## [1.1.4] - 2025-11-19

### Fixed

- Implementing schema creation for required tables

## [1.1.2] - 2025-10-27

### Changed

- Fix documentation entities

## [1.1.1] - 2025-10-27

### Changed

- Removed `transformInput` and `transformOutput` functions

### Fixed

- Improved type safety in update operations

## [1.0.0] - 2025-10-23

### Added

- Initial release of Better Auth TypeORM Adapter
- Full CRUD operations support
- Custom entity mapping
- Debug logging
- TypeScript support
- Multi-database support (PostgreSQL, MySQL, SQLite, etc.)
- Comprehensive documentation
- Example implementations
- Unit tests

### Features

- `create` - Create new records
- `update` - Update single record
- `updateMany` - Update multiple records
- `delete` - Delete single record
- `deleteMany` - Delete multiple records
- `findOne` - Find single record
- `findMany` - Find multiple records with pagination and sorting
- `count` - Count records

### Supported

- Better Auth 1.3.0+
- TypeORM 0.3.0+
- Node.js 18.0.0+
