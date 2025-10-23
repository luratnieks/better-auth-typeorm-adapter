/**
 * Basic Usage Example
 * 
 * This example shows how to use the TypeORM adapter with Better Auth
 */

import { betterAuth } from 'better-auth';
import { typeormAdapter } from 'better-auth-typeorm-adapter';
import { DataSource } from 'typeorm';
import { User, Account, Session, Verification } from './entities';

// 1. Create DataSource
const AppDataSource = new DataSource({
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  username: 'postgres',
  password: 'postgres',
  database: 'myapp',
  synchronize: false, // Use migrations in production!
  logging: false,
  entities: [User, Account, Session, Verification],
});

// 2. Initialize DataSource
await AppDataSource.initialize();
console.log('✅ DataSource initialized');

// 3. Create Better Auth instance with TypeORM adapter
export const auth = betterAuth({
  database: typeormAdapter({
    dataSource: AppDataSource,
  }),
  
  emailAndPassword: {
    enabled: true,
  },
  
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
});

console.log('✅ Better Auth configured with TypeORM adapter');

// 4. Use Better Auth
export type Auth = typeof auth;

