import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import pino, { Logger as PinoLogger } from 'pino';
import { LogContext, LogLevel } from '../types';

@Injectable()
export class LoggerService implements NestLoggerService {
  private logger: PinoLogger;
  private serviceName: string;

  constructor(serviceName: string, options?: any) {
    this.serviceName = serviceName;

    const isDevelopment = process.env.NODE_ENV !== 'production';

    this.logger = pino({
      level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
      formatters: {
        level: (label) => {
          return { level: label };
        },
      },
      redact: {
        paths: [
          'password',
          'token',
          'accessToken',
          'refreshToken',
          'authorization',
          'cpf',
          'creditCard',
          '*.password',
          '*.token',
          '*.accessToken',
          '*.refreshToken',
        ],
        remove: true,
      },
      transport: isDevelopment
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss Z',
              ignore: 'pid,hostname',
            },
          }
        : undefined,
    });
  }

  private buildContext(context?: any): LogContext {
    const baseContext: LogContext = {
      service: this.serviceName,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
    };

    if (typeof context === 'string') {
      return { ...baseContext, context };
    }

    if (typeof context === 'object' && context !== null) {
      return { ...baseContext, ...context };
    }

    return baseContext;
  }

  log(message: string, context?: any) {
    this.info(message, context);
  }

  info(message: string, context?: any) {
    const ctx = this.buildContext(context);
    this.logger.info(ctx, message);
  }

  error(message: string, trace?: string, context?: any) {
    const ctx = this.buildContext(context);
    if (trace) {
      this.logger.error({ ...ctx, trace }, message);
    } else {
      this.logger.error(ctx, message);
    }
  }

  warn(message: string, context?: any) {
    const ctx = this.buildContext(context);
    this.logger.warn(ctx, message);
  }

  debug(message: string, context?: any) {
    const ctx = this.buildContext(context);
    this.logger.debug(ctx, message);
  }

  verbose(message: string, context?: any) {
    const ctx = this.buildContext(context);
    this.logger.trace(ctx, message);
  }

  fatal(message: string, context?: any) {
    const ctx = this.buildContext(context);
    this.logger.fatal(ctx, message);
  }

  // Métodos adicionais para logs estruturados
  logWithLevel(level: LogLevel, message: string, context?: any) {
    const ctx = this.buildContext(context);
    this.logger[level](ctx, message);
  }

  // Log de eventos de negócio
  logEvent(eventType: string, data: any, context?: any) {
    const ctx = this.buildContext({ ...context, eventType });
    this.logger.info(ctx, `Event: ${eventType}`, data);
  }

  // Log de métricas de performance
  logMetric(metric: string, value: number, unit: string, context?: any) {
    const ctx = this.buildContext({ ...context, metric, value, unit });
    this.logger.info(ctx, `Metric: ${metric} = ${value}${unit}`);
  }

  // Log de HTTP request/response
  logHttp(method: string, path: string, statusCode: number, duration: number, context?: any) {
    const ctx = this.buildContext({
      ...context,
      http: {
        method,
        path,
        statusCode,
        duration,
      },
    });
    this.logger.info(ctx, `${method} ${path} ${statusCode} - ${duration}ms`);
  }
}
