import { Controller, Get, Inject } from '@nestjs/common';
import {
    HealthCheck,
    HealthCheckService,
    TypeOrmHealthIndicator,
    HealthCheckResult,
} from '@nestjs/terminus';
import { RabbitMQHealthIndicator } from './rabbitmq-health.indicator';
import { HEALTH_OPTIONS } from './health.tokens';
import type { HealthModuleOptions } from './health.tokens';

@Controller('health')
export class HealthController {
    constructor(
        private health: HealthCheckService,
        private db: TypeOrmHealthIndicator,
        private rmq: RabbitMQHealthIndicator,
        @Inject(HEALTH_OPTIONS) private options: HealthModuleOptions
    ) {}

    @Get()
    @HealthCheck()
    check(): Promise<HealthCheckResult> {
        return this.health.check(this.buildChecks());
    }

    @Get('ready')
    @HealthCheck()
    ready(): Promise<HealthCheckResult> {
        // Readiness: verifica banco e filas RabbitMQ (se configurado)
        return this.health.check(this.buildChecks());
    }

    @Get('live')
    live(): { status: string; timestamp: string } {
        // Liveness: apenas verifica se o processo está vivo
        return {
            status: 'ok',
            timestamp: new Date().toISOString(),
        };
    }

    private buildChecks() {
        const checks: Array<() => Promise<any>> = [];

        if (this.options.database) {
            checks.push(() => this.db.pingCheck('database', { timeout: 300 }));
        }

        if (this.options.rabbitmq) {
            checks.push(() =>
                this.rmq.checkQueues('rabbitmq', {
                    maxQueueDepth: this.options.rabbitmqMaxQueueDepth ?? 1000,
                })
            );
        }

        return checks;
    }
}
