import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export type OutboxStatus = 'PENDING' | 'PUBLISHED' | 'FAILED';

@Entity('outbox')
export class OutboxEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'event_type' })
    eventType: string;

    @Column({ type: 'jsonb' })
    payload: Record<string, unknown>;

    @Index()
    @Column({ type: 'varchar', default: 'PENDING' })
    status: OutboxStatus;

    @Column({ type: 'int', default: 0 })
    attempts: number;

    @Column({ name: 'last_error', type: 'text', nullable: true })
    lastError: string | null;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @Column({ name: 'published_at', type: 'timestamp', nullable: true })
    publishedAt: Date | null;
}
