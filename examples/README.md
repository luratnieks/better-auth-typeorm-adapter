# Examples

This directory contains examples of how to use the Better Auth TypeORM Adapter in different scenarios.

## Available Examples

### 1. Basic Usage (`basic-usage.ts`)

Simple setup showing the minimal configuration needed to get started.

### 2. NestJS Integration (`nestjs-usage.ts`)

Complete example of integrating the adapter in a NestJS application with:

- Module setup
- Service implementation
- Controller endpoints
- TypeORM integration

### 3. Custom Entities (`custom-entities.ts`)

How to use custom entity names and mappings instead of the default Better Auth entities.

### 4. Entity Examples (`entities/`)

Complete entity definitions with UUID primary keys for:

- `user.entity.ts` - User entity with relationships
- `account.entity.ts` - OAuth account entity
- `session.entity.ts` - Session entity with foreign keys
- `verification.entity.ts` - Verification token entity

These entities are automatically generated when using the Better Auth CLI generate command.

## Running Examples

To run any example:

1. Install dependencies:

```bash
npm install
```

2. Set up your database and environment variables

3. Run the example:

```bash
npx ts-node examples/basic-usage.ts
```

## Database Setup

Before running examples, make sure you have:

1. A PostgreSQL/MySQL/SQLite database running
2. Database credentials configured
3. Tables created (you can use TypeORM migrations or Better Auth CLI)

### Generate Entities with Better Auth CLI

The adapter now supports automatic entity generation:

```bash
npx @better-auth/cli generate
```

This will create TypeORM entity files in `./src/entities/` with:

- UUID primary keys (`@PrimaryGeneratedColumn('uuid')`)
- Proper relationships and foreign keys
- All required Better Auth fields
- TypeScript decorators

You can specify a custom output directory:

```bash
npx @better-auth/cli generate --output ./custom/path
```

Alternatively, use TypeORM migrations:

```bash
npx typeorm migration:generate -n CreateBetterAuthTables
npx typeorm migration:run
```

## Need Help?

Check the main [README.md](../README.md) for detailed documentation.
