import { Module, DynamicModule } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HttpModule } from '@nestjs/axios';
import { HealthController } from './health.controller';
import { RabbitMQHealthIndicator } from './rabbitmq-health.indicator';
import { HEALTH_OPTIONS, HealthModuleOptions } from './health.tokens';

export { HEALTH_OPTIONS } from './health.tokens';
export type { HealthModuleOptions } from './health.tokens';

@Module({
    imports: [TerminusModule, HttpModule],
    controllers: [HealthController],
    providers: [
        { provide: HEALTH_OPTIONS, useValue: { database: false } },
        RabbitMQHealthIndicator,
    ],
    exports: [RabbitMQHealthIndicator],
})
export class HealthModule {
    static forRoot(options: HealthModuleOptions = {}): DynamicModule {
        return {
            module: HealthModule,
            imports: [TerminusModule, HttpModule],
            controllers: [HealthController],
            providers: [
                { provide: HEALTH_OPTIONS, useValue: options },
                RabbitMQHealthIndicator,
            ],
            exports: [RabbitMQHealthIndicator],
        };
    }
}
