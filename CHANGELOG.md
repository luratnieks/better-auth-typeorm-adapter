# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.1] - 2025-10-27

### Changed

- Removed `transformInput` and `transformOutput` functions

### Fixed

- Improved type safety in update operations

## [1.0.0] - 2025-01-XX

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

- ✅ `create` - Create new records
- ✅ `update` - Update single record
- ✅ `updateMany` - Update multiple records
- ✅ `delete` - Delete single record
- ✅ `deleteMany` - Delete multiple records
- ✅ `findOne` - Find single record
- ✅ `findMany` - Find multiple records with pagination and sorting
- ✅ `count` - Count records

### Supported

- Better Auth 1.3.0+
- TypeORM 0.3.0+
- Node.js 18.0.0+
