import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * User Entity for Better Auth
 * 
 * Table: user
 * Schema: Compatible with Better Auth 1.3+
 * 
 * NOTE: Using UUID with automatic generation by PostgreSQL
 */
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

