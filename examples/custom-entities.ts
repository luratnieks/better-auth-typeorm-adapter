/**
 * Custom Entities Example
 * 
 * This example shows how to use custom entity names with the adapter
 */

import { betterAuth } from 'better-auth';
import { typeormAdapter } from 'better-auth-typeorm-adapter';
import { DataSource, Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

// Custom entity with different name
@Entity('app_users') // Different table name
export class AppUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar', { unique: true })
  email: string;

  @Column('boolean', { default: false })
  emailVerified: boolean;

  @Column('varchar', { nullable: true })
  name: string | null;

  @Column('varchar', { nullable: true })
  image: string | null;

  @Column('varchar', { nullable: true })
  password: string | null;

  // Custom fields
  @Column('varchar', { nullable: true })
  phone: string | null;

  @Column('jsonb', { nullable: true })
  metadata: Record<string, any> | null;
}

// Similarly for other entities...
@Entity('app_accounts')
export class AppAccount {
  // ... account fields
}

@Entity('app_sessions')
export class AppSession {
  // ... session fields
}

@Entity('app_verifications')
export class AppVerification {
  // ... verification fields
}

// DataSource with custom entities
const AppDataSource = new DataSource({
  type: 'postgres',
  // ... connection config
  entities: [AppUser, AppAccount, AppSession, AppVerification],
});

await AppDataSource.initialize();

// Configure Better Auth with custom entity mapping
export const auth = betterAuth({
  database: typeormAdapter({
    dataSource: AppDataSource,
    entities: {
      user: AppUser,
      account: AppAccount,
      session: AppSession,
      verification: AppVerification,
    },
  }),
  
  emailAndPassword: {
    enabled: true,
  },
});

console.log('✅ Better Auth configured with custom entities');

