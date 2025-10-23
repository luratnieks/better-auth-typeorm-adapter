import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

/**
 * Account Entity for Better Auth
 * 
 * Table: account
 * Schema: Compatible with Better Auth 1.3+
 * 
 * Stores OAuth provider accounts (Google, GitHub, etc.)
 * and also email/password accounts
 */
@Entity('account')
export class Account {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar', { name: 'user_id' })
  userId: string;

  @Column('varchar', { name: 'account_id', nullable: false })
  accountId: string;

  @Column('varchar', { nullable: false })
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

  @Column('varchar', { nullable: true })
  password: string | null;

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
  updatedAt: Date;

  // Relationship
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}

