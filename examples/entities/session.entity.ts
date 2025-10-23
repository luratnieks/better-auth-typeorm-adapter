import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

/**
 * Session Entity for Better Auth
 * 
 * Table: session
 * Schema: Compatible with Better Auth 1.3+
 */
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

  // Relationship
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}

