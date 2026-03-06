import { Module, Global } from '@nestjs/common';
import { CorrelationService } from './correlation.service';
import { CorrelationMiddleware } from './correlation.middleware';
import { CorrelationInterceptor } from './correlation.interceptor';

@Global()
@Module({
    providers: [CorrelationService, CorrelationMiddleware, CorrelationInterceptor],
    exports: [CorrelationService, CorrelationMiddleware, CorrelationInterceptor],
})
export class CorrelationModule {}
