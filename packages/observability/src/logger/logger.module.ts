import { Module, Global, DynamicModule } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { LoggerService } from './logger.service';
import { LoggerInterceptor } from './logger.interceptor';
import { trace } from '@opentelemetry/api';

export interface LoggerModuleOptions {
    serviceName: string;
}

@Global()
@Module({})
export class LoggerModule {
    static forRoot(options: LoggerModuleOptions): DynamicModule {
        const isDevelopment = process.env.NODE_ENV !== 'production';

        const loggerProvider = {
            provide: LoggerService,
            useFactory: () => new LoggerService(options.serviceName),
        };

        return {
            module: LoggerModule,
            imports: [
                PinoLoggerModule.forRoot({
                    pinoHttp: {
                        level: process.env.LOG_LEVEL ?? (isDevelopment ? 'debug' : 'info'),
                        autoLogging: true,
                        customProps: (req) => ({
                            service: options.serviceName,
                            correlationId: req.headers['x-correlation-id'],
                        }),
                        // Injeta traceId/spanId do OTel active span em cada log de request
                        customAttributeKeys: { responseTime: 'durationMs' },
                        serializers: {
                            req: (req) => ({ method: req.method, url: req.url }),
                            res: (res) => ({ statusCode: res.statusCode }),
                        },
                        formatters: {
                            log(obj: Record<string, unknown>) {
                                const span = trace.getActiveSpan();
                                if (!span) return obj;
                                const ctx = span.spanContext();
                                if (ctx.traceId === '00000000000000000000000000000000') return obj;
                                return { ...obj, traceId: ctx.traceId, spanId: ctx.spanId };
                            },
                        },
                        redact: {
                            paths: [
                                'req.headers.authorization',
                                'req.headers.cookie',
                                '*.password',
                                '*.token',
                                '*.accessToken',
                            ],
                            remove: true,
                        },
                        transport: isDevelopment
                            ? {
                                  target: 'pino-pretty',
                                  options: { colorize: true, ignore: 'pid,hostname' },
                              }
                            : undefined,
                    },
                }),
            ],
            providers: [loggerProvider, LoggerInterceptor],
            exports: [LoggerService, LoggerInterceptor, PinoLoggerModule],
        };
    }
}
