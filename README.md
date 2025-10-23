# Better Auth TypeORM Adapter

[![npm version](https://badge.fury.io/js/better-auth-typeorm-adapter.svg)](https://www.npmjs.com/package/better-auth-typeorm-adapter)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A production-ready **TypeORM adapter** for [Better Auth](https://github.com/better-auth/better-auth) - the modern authentication library for TypeScript.

## ✨ Features

- 🎯 **Full Better Auth Support** - All operations implemented (CRUD, queries, etc.)
- 🔒 **Type-Safe** - 100% TypeScript with full type inference
- 🗄️ **Multi-Database** - Works with PostgreSQL, MySQL, SQLite, and more
- ⚡ **Production Ready** - Battle-tested in real applications
- 🔧 **Flexible** - Custom entity mappings and configuration
- 📦 **Zero Dependencies** - Only peer dependencies on Better Auth and TypeORM
- 🐛 **Debug Mode** - Built-in logging for troubleshooting

## 📦 Installation

```bash
npm install better-auth-typeorm-adapter better-auth typeorm
```

```bash
yarn add better-auth-typeorm-adapter better-auth typeorm
```

```bash
pnpm add better-auth-typeorm-adapter better-auth typeorm
```

## 🚀 Quick Start

### 1. Create TypeORM Entities

Create entities matching Better Auth schema:

```typescript
// user.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('user')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar', { unique: true })
  email: string;

  @Column('boolean', { default: false, name: 'email_verified' })
  emailVerified: boolean;

  @Column('varchar', { nullable: true })
  name: string | null;

  @Column('varchar', { nullable: true })
  image: string | null;

  @Column('varchar', { nullable: true })
  password: string | null;

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
  updatedAt: Date;
}
```

<details>
<summary>See all required entities (Account, Session, Verification)</summary>

```typescript
// account.entity.ts
@Entity('account')
export class Account {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar', { name: 'user_id' })
  userId: string;

  @Column('varchar', { name: 'account_id' })
  accountId: string;

  @Column('varchar')
  provider: string;

  @Column('varchar', { nullable: true, name: 'access_token' })
  accessToken: string | null;

  @Column('varchar', { nullable: true, name: 'refresh_token' })
  refreshToken: string | null;

  @Column('timestamp', { nullable: true, name: 'expires_at' })
  expiresAt: Date | null;

  @Column('varchar', { nullable: true })
  scope: string | null;

  @Column('varchar', { nullable: true, name: 'id_token' })
  idToken: string | null;

  @Column('varchar', { nullable: true, name: 'token_type' })
  tokenType: string | null;

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}

// session.entity.ts
@Entity('session')
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar', { name: 'user_id' })
  userId: string;

  @Column('timestamp', { name: 'expires_at' })
  expiresAt: Date;

  @Column('varchar', { unique: true })
  token: string;

  @Column('varchar', { nullable: true, name: 'ip_address' })
  ipAddress: string | null;

  @Column('varchar', { nullable: true, name: 'user_agent' })
  userAgent: string | null;

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}

// verification.entity.ts
@Entity('verification')
export class Verification {
  @PrimaryColumn('varchar')
  id: string;

  @Column('varchar')
  identifier: string;

  @Column('varchar')
  value: string;

  @Column('timestamp', { name: 'expires_at' })
  expiresAt: Date;

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt: Date;
}
```

</details>

### 2. Setup DataSource

```typescript
// data-source.ts
import { DataSource } from 'typeorm';
import { User, Account, Session, Verification } from './entities';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  username: 'postgres',
  password: 'postgres',
  database: 'myapp',
  entities: [User, Account, Session, Verification],
  synchronize: false, // Use migrations in production
});
```

### 3. Configure Better Auth

```typescript
// auth.ts
import { betterAuth } from 'better-auth';
import { typeormAdapter } from 'better-auth-typeorm-adapter';
import { AppDataSource } from './data-source';

// Initialize DataSource
await AppDataSource.initialize();

export const auth = betterAuth({
  database: typeormAdapter({
    dataSource: AppDataSource,
  }),
  emailAndPassword: {
    enabled: true,
  },
  // ... other Better Auth options
});
```

### 4. Use with NestJS (Optional)

```typescript
// auth.module.ts
import { Module, OnModuleInit } from '@nestjs/common';
import { betterAuth } from 'better-auth';
import { typeormAdapter } from 'better-auth-typeorm-adapter';
import { DataSource } from 'typeorm';

@Module({})
export class AuthModule implements OnModuleInit {
  constructor(private dataSource: DataSource) {}

  async onModuleInit() {
    const auth = betterAuth({
      database: typeormAdapter({
        dataSource: this.dataSource,
        debugLogs: process.env.NODE_ENV === 'development',
      }),
    });
  }
}
```

## 🔧 Configuration

### Basic Configuration

```typescript
typeormAdapter({
  dataSource: AppDataSource,  // Required
  debugLogs: true,            // Optional: Enable debug logs
  usePlural: false,           // Optional: Use plural table names
})
```

### Custom Entity Mapping

Map Better Auth models to your custom entities:

```typescript
typeormAdapter({
  dataSource: AppDataSource,
  entities: {
    user: MyCustomUserEntity,
    session: MyCustomSessionEntity,
    account: MyCustomAccountEntity,
    verification: MyCustomVerificationEntity,
  },
})
```

### Debug Mode

Enable detailed logging for troubleshooting:

```typescript
typeormAdapter({
  dataSource: AppDataSource,
  debugLogs: {
    isRunningAdapterTests: true,
    logQueries: true,
  },
})
```

## 📋 Supported Databases

Works with all TypeORM-supported databases:

- ✅ PostgreSQL
- ✅ MySQL / MariaDB
- ✅ SQLite
- ✅ Microsoft SQL Server
- ✅ Oracle
- ✅ CockroachDB

## 🎯 API Reference

### `typeormAdapter(config)`

Creates a Better Auth adapter using TypeORM.

#### Parameters

- `config.dataSource` **(required)**: TypeORM DataSource instance (must be initialized)
- `config.debugLogs` *(optional)*: Enable debug logs
- `config.usePlural` *(optional)*: Use plural table names (default: false)
- `config.entities` *(optional)*: Custom entity mappings

#### Returns

Better Auth adapter instance.

## 🧪 Testing

```bash
npm test
```

Run with coverage:

```bash
npm run test:cov
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

MIT © Lucas Ratnieks

## 🙏 Credits

- [Better Auth](https://github.com/better-auth/better-auth) - The authentication library this adapter is built for
- [TypeORM](https://typeorm.io/) - The ORM this adapter uses

## 📚 Resources

- [Better Auth Documentation](https://www.better-auth.com/docs)
- [TypeORM Documentation](https://typeorm.io/)
- [GitHub Repository](https://github.com/seu-usuario/better-auth-typeorm-adapter)

## 🐛 Issues & Support

If you encounter any issues or need support, please [open an issue](https://github.com/seu-usuario/better-auth-typeorm-adapter/issues) on GitHub.

---

Made with ❤️ for the Better Auth community

# better-auth-typeorm-adapter
