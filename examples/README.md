# Examples

This directory contains examples of how to use the Better Auth TypeORM Adapter in different scenarios.

## Available Examples

### 0. Generated Entity Schemas (`generated-schemas.ts`) — recommended

Derives every table (including plugin tables) from your Better Auth options
with `generateEntitySchemas`, so no entity classes need to be written.

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

Complete entity definitions with text primary keys (Better Auth supplies its own string ids) for:

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

This writes a single `auth-entities.ts` file containing one entity class per
Better Auth model, with:

- Text primary keys (`@PrimaryColumn('text')` — Better Auth supplies its own string ids)
- Relationships and foreign keys derived from the schema `references`
- `simple-json` columns for JSON fields
- Driver-appropriate date column types

You can specify a custom output file:

```bash
npx @better-auth/cli generate --output src/entities/auth-entities.ts
```

Alternatively, use TypeORM migrations:

```bash
npx typeorm migration:generate -n CreateBetterAuthTables
npx typeorm migration:run
```

## Need Help?

Check the main [README.md](../README.md) for detailed documentation.
