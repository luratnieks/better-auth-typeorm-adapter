/**
 * Custom Entities Example
 * 
 * This example shows how to use custom entity names with the adapter
 */

import { betterAuth } from 'better-auth';
import { typeormAdapter } from 'better-auth-typeorm-adapter';
import { DataSource, Entity, Column, PrimaryColumn } from 'typeorm';

// Custom entity with different name.
// Note: the id is a text primary column — Better Auth generates and
// supplies its own string ids, so do NOT use @PrimaryGeneratedColumn.
@Entity('app_users') // Different table name
export class AppUser {
  @PrimaryColumn('text')
  id: string;

  @Column('varchar', { unique: true })
  email: string;

  @Column('boolean', { default: false })
  emailVerified: boolean;

  @Column('varchar', { nullable: true })
  name: string | null;

  @Column('varchar', { nullable: true })
  image: string | null;

  @Column('timestamptz')
  createdAt: Date;

  @Column('timestamptz')
  updatedAt: Date;

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

// Configure Better Auth with custom entity mapping.
// The adapter initializes the DataSource lazily, so no explicit
// initialize() call is required. Plugin models can be mapped too
// (e.g. organization: AppOrganization).
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

console.log('Better Auth configured with custom entities');

