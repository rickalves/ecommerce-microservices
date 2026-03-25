import { Injectable, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { LoggerService, MetricsService } from '@ecommerce/observability';
import { OutboxEntity, OutboxStatus } from '../database/entities/outbox.entity';

const MAX_ATTEMPTS = 5;
const POLL_INTERVAL_MS = 5_000;
const BATCH_SIZE = 50;

@Injectable()
export class OutboxProcessor implements OnModuleInit, OnModuleDestroy {
    private intervalId: NodeJS.Timeout | null = null;

    constructor(
        @InjectDataSource() private readonly dataSource: DataSource,
        @Inject('EVENT_BUS') private readonly eventBus: ClientProxy,
        private readonly logger: LoggerService,
        private readonly metrics: MetricsService
    ) {}

    onModuleInit() {
        void this.poll();
        this.intervalId = setInterval(() => void this.poll(), POLL_INTERVAL_MS);
    }

    onModuleDestroy() {
        if (this.intervalId) clearInterval(this.intervalId);
    }

    private async poll(): Promise<void> {
        const repo = this.dataSource.getRepository(OutboxEntity);
        let records: OutboxEntity[];

        try {
            records = await repo.find({
                where: { status: 'PENDING' as OutboxStatus },
                order: { createdAt: 'ASC' },
                take: BATCH_SIZE,
            });
        } catch {
            // DB not yet ready on first poll — skip silently
            return;
        }

        for (const record of records) {
            try {
                this.eventBus.emit(record.eventType, record.payload);
                await repo.update(record.id, {
                    status: 'PUBLISHED' as OutboxStatus,
                    publishedAt: new Date(),
                });
                this.metrics.eventPublishedTotal.inc({ event_type: record.eventType });
                this.logger.debug('Outbox event published', {
                    outboxId: record.id,
                    eventType: record.eventType,
                });
            } catch (err) {
                const attempts = record.attempts + 1;
                const permanentlyFailed = attempts >= MAX_ATTEMPTS;
                await repo.update(record.id, {
                    attempts,
                    status: (permanentlyFailed ? 'FAILED' : 'PENDING') as OutboxStatus,
                    lastError: (err as Error).message,
                });
                if (permanentlyFailed) {
                    this.logger.error(
                        'Outbox event permanently failed after max retries',
                        (err as Error).stack,
                        { outboxId: record.id, eventType: record.eventType, attempts }
                    );
                }
            }
        }
    }
}
