import { Entity, Column, PrimaryColumn, CreateDateColumn } from 'typeorm';

/**
 * Verification Entity for Better Auth
 * 
 * Table: verification
 * Schema: Compatible with Better Auth 1.3+
 * 
 * Used for:
 * - Email verification
 * - Password reset
 * - General verification tokens
 */
@Entity('verification')
export class Verification {
  @PrimaryColumn('varchar')
  id: string;

  @Column('varchar')
  identifier: string;  // Email or other identifier

  @Column('varchar')
  value: string;  // Token

  @Column('timestamp', { name: 'expires_at' })
  expiresAt: Date;

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt: Date;
}

