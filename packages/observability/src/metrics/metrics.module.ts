import { Module, Global, DynamicModule } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MetricsService, MetricsModuleOptions } from './metrics.service';
import { MetricsController } from './metrics.controller';
import { MetricsInterceptor } from './metrics.interceptor';
import { RabbitMQLagCollector } from './rabbitmq-lag.collector';

@Global()
@Module({})
export class MetricsModule {
    static forRoot(options: MetricsModuleOptions): DynamicModule {
        const metricsProvider = {
            provide: MetricsService,
            useFactory: () => new MetricsService(options),
        };

        return {
            module: MetricsModule,
            imports: [HttpModule],
            controllers: [MetricsController],
            providers: [metricsProvider, MetricsInterceptor, RabbitMQLagCollector],
            exports: [MetricsService, MetricsInterceptor],
        };
    }
}
