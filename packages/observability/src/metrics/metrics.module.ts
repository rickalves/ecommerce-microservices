import { Module, Global, DynamicModule } from '@nestjs/common';
import { MetricsService, MetricsModuleOptions } from './metrics.service';
import { MetricsController } from './metrics.controller';
import { MetricsInterceptor } from './metrics.interceptor';

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
            controllers: [MetricsController],
            providers: [metricsProvider, MetricsInterceptor],
            exports: [MetricsService, MetricsInterceptor],
        };
    }
}
