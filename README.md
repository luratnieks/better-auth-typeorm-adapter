# Better Auth TypeORM Adapter

[![npm version](https://img.shields.io/npm/v/better-auth-typeorm-adapter.svg)](https://www.npmjs.com/package/better-auth-typeorm-adapter)
[![npm downloads](https://img.shields.io/npm/dm/better-auth-typeorm-adapter.svg)](https://www.npmjs.com/package/better-auth-typeorm-adapter)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.1+-blue.svg)](https://www.typescriptlang.org/)

A production-ready **TypeORM adapter** for [Better Auth](https://github.com/better-auth/better-auth) — the modern authentication library for TypeScript.

Validated against the official `@better-auth/test-utils` adapter test suites (CRUD semantics, auth flows, transactions, UUID IDs, and case-insensitive matching).

## Support & Contributions

**Author Contact:**

- [![X (Twitter)](https://img.shields.io/badge/X-000000?style=flat&logo=x&logoColor=white)](https://x.com/olucasrat) [@olucasrat](https://x.com/olucasrat)
- **Email:** lucas@uvvipay.com.br

Need help or want to contribute? Reach out on X or by email. Pull requests and issues are always welcome!

## Features

- **Full Better Auth Support** — Every adapter operation, every `where` operator (`eq`, `ne`, `lt`, `lte`, `gt`, `gte`, `in`, `not_in`, `contains`, `starts_with`, `ends_with`), `OR` connectors, and case-insensitive matching
- **Plugin Ready** — Models added by plugins (`organization`, `twoFactor`, `passkey`, ...) resolve automatically; no manual mapping required
- **Zero-Boilerplate Entities** — `generateEntitySchemas()` builds TypeORM `EntitySchema` definitions straight from your Better Auth options
- **ORM-Native** — Uses TypeORM repositories, so your entity hooks (`@BeforeInsert`, ...), transformers, and naming strategies keep working
- **Multi-Database** — PostgreSQL, MySQL/MariaDB, SQLite, SQL Server, CockroachDB, and more
- **Soft Delete** — Opt-in per model via `softDeleteEnabledEntities`
- **CLI Schema Generation** — `npx @better-auth/cli generate` emits decorator-based entity classes
- **Tested** — Runs the official Better Auth adapter test suites plus a dedicated regression suite
- **Debug Mode** — Built-in logging for troubleshooting

## Installation

```bash
npm install better-auth-typeorm-adapter better-auth typeorm
```

Requires `better-auth >= 1.6`, `typeorm >= 0.3`, and Node.js `>= 20.19`.

## Quick Start

### Option A — Generated entity schemas (recommended)

Let the adapter derive every table (including plugin tables) from your Better Auth options:

```typescript
// auth.ts
import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { typeormAdapter, generateEntitySchemas } from 'better-auth-typeorm-adapter';
import { DataSource } from 'typeorm';

const betterAuthOptions = {
  emailAndPassword: { enabled: true },
  // plugins: [organization(), twoFactor()],
} satisfies BetterAuthOptions;

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: generateEntitySchemas(betterAuthOptions),
  synchronize: false, // use migrations in production
});

export const auth = betterAuth({
  ...betterAuthOptions,
  database: typeormAdapter({ dataSource: AppDataSource }),
});
```

The adapter initializes the `DataSource` lazily on first use, so you don't need to call `initialize()` yourself.

To create the tables, set `synchronize: true` in development and TypeORM will build them from the registered schemas automatically. In production, generate migrations from those schemas instead (`npx typeorm migration:generate`) and keep `synchronize: false`.

### Option B — Generated entity classes (CLI)

Generate decorator-based entity classes and keep them in your codebase:

```bash
npx @better-auth/cli generate --output src/entities/auth-entities.ts
```

The generated classes use `@PrimaryColumn('text')` (Better Auth supplies its own string IDs), map relations from the schema references, and use `simple-json` columns for JSON fields. Register them on your `DataSource` and you're done.

### Option C — Hand-written entities

If you prefer writing entities yourself, follow this contract:

- **`id` must be a text primary column** (`@PrimaryColumn('text')`), NOT `@PrimaryGeneratedColumn('uuid')` — Better Auth generates and supplies its own string IDs.
- **Property names must match the Better Auth field names** (`userId`, `expiresAt`, ...). Column names can differ (e.g., snake_case via `@Column({ name: 'user_id' })` or a naming strategy).
- JSON fields (from plugins) should use `simple-json` columns.

```typescript
// user.entity.ts
import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('user')
export class User {
  @PrimaryColumn('text')
  id!: string;

  @Column('varchar', { length: 255, unique: true })
  email!: string;

  @Column('boolean')
  emailVerified!: boolean;

  @Column('text')
  name!: string;

  @Column('text', { nullable: true })
  image?: string | null;

  @Column('timestamptz') // use 'datetime' on MySQL/SQLite
  createdAt!: Date;

  @Column('timestamptz')
  updatedAt!: Date;
}
```

## Configuration

```typescript
typeormAdapter({
  // Required: the TypeORM DataSource (initialized lazily if needed).
  dataSource: AppDataSource,

  // Optional: enable Better Auth adapter debug logs.
  debugLogs: process.env.NODE_ENV === 'development',

  // Optional: plural table names (users, sessions, ...). Default: false.
  usePlural: false,

  // Optional: explicit model -> entity mapping. Any model can be mapped,
  // including plugin models. Unmapped models resolve by entity/table name.
  entities: {
    user: MyCustomUserEntity,
    organization: MyOrgEntity,
  },

  // Optional: models deleted via soft delete. The entity must declare
  // a @DeleteDateColumn().
  softDeleteEnabledEntities: ['user'],
});
```

### `generateEntitySchemas(options, config?)`

Builds one TypeORM `EntitySchema` per Better Auth model (core + plugins), derived from your auth options. Use it to register entities without writing any classes:

```typescript
const dataSource = new DataSource({
  type: 'better-sqlite3',
  database: 'auth.db',
  entities: generateEntitySchemas(betterAuthOptions, { usePlural: false }),
  synchronize: true, // or manage via migrations
});
```

## Supported Databases

Works with all TypeORM-supported databases:

- PostgreSQL
- MySQL / MariaDB
- SQLite
- Microsoft SQL Server
- Oracle
- CockroachDB

## API Reference

### `typeormAdapter(config)`

Creates a Better Auth database adapter backed by TypeORM repositories.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `dataSource` | `DataSource` | required | TypeORM DataSource; initialized lazily when needed |
| `debugLogs` | `boolean \| object` | `false` | Better Auth adapter debug logging |
| `usePlural` | `boolean` | `false` | Plural table names |
| `entities` | `Record<string, EntityTarget>` | `{}` | Explicit model → entity mapping (any model, plugins included) |
| `softDeleteEnabledEntities` | `string[]` | `[]` | Models removed via `softRemove` instead of hard delete |

### `generateEntitySchemas(options, config?)`

Returns `EntitySchema[]` for every Better Auth model derived from `options`. `config.usePlural` must match the adapter's `usePlural`.

## Testing

```bash
npm test             # regression tests (node:test) + official adapter suites (vitest)
npm run test:unit    # regression tests only
npm run test:adapter # official @better-auth/test-utils suites only
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

MIT Lucas Ratnieks

## Credits

- [Better Auth](https://github.com/better-auth/better-auth) — The authentication library this adapter is built for
- [TypeORM](https://typeorm.io/) — The ORM this adapter uses

## Resources

- [Better Auth Documentation](https://www.better-auth.com/docs)
- [TypeORM Documentation](https://typeorm.io/)
- [GitHub Repository](https://github.com/luratnieks/better-auth-typeorm-adapter)

## Issues & Support

If you encounter any issues or need support, please [open an issue](https://github.com/luratnieks/better-auth-typeorm-adapter/issues) on GitHub.

---

Made for the Better Auth community
