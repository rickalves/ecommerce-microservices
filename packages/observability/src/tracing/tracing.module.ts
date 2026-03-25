import { Module } from '@nestjs/common';
import { TracingInterceptor } from './tracing.interceptor';

@Module({
    providers: [TracingInterceptor],
    exports: [TracingInterceptor],
})
export class TracingModule {}
