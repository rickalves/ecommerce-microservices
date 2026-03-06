import { Controller, Get, Inject } from '@nestjs/common';
import {
    HealthCheck,
    HealthCheckService,
    TypeOrmHealthIndicator,
    HealthCheckResult,
} from '@nestjs/terminus';
import { HEALTH_OPTIONS } from './health.tokens';
import type { HealthModuleOptions } from './health.tokens';

@Controller('health')
export class HealthController {
    constructor(
        private health: HealthCheckService,
        private db: TypeOrmHealthIndicator,
        @Inject(HEALTH_OPTIONS) private options: HealthModuleOptions
    ) {}

    @Get()
    @HealthCheck()
    check(): Promise<HealthCheckResult> {
        const checks = this.options.database
            ? [() => this.db.pingCheck('database', { timeout: 300 })]
            : [];
        return this.health.check(checks);
    }

    @Get('ready')
    @HealthCheck()
    ready(): Promise<HealthCheckResult> {
        // Readiness: serviço está pronto para receber tráfego
        const checks = this.options.database
            ? [() => this.db.pingCheck('database', { timeout: 300 })]
            : [];
        return this.health.check(checks);
    }

    @Get('live')
    live(): { status: string; timestamp: string } {
        // Liveness: serviço está vivo (não travado)
        return {
            status: 'ok',
            timestamp: new Date().toISOString(),
        };
    }
}
