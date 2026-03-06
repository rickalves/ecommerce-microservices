import { Module, Global, DynamicModule } from '@nestjs/common';
import { LoggerService } from './logger.service';
import { LoggerInterceptor } from './logger.interceptor';

export interface LoggerModuleOptions {
    serviceName: string;
}

@Global()
@Module({})
export class LoggerModule {
    static forRoot(options: LoggerModuleOptions): DynamicModule {
        const loggerProvider = {
            provide: LoggerService,
            useFactory: () => {
                return new LoggerService(options.serviceName);
            },
        };

        return {
            module: LoggerModule,
            providers: [loggerProvider, LoggerInterceptor],
            exports: [LoggerService, LoggerInterceptor],
        };
    }
}
