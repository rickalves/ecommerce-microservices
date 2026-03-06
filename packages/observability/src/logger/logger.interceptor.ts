import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { LoggerService } from './logger.service';

@Injectable()
export class LoggerInterceptor implements NestInterceptor {
  constructor(private readonly logger: LoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const contextType = context.getType();
    const startTime = Date.now();

    if (contextType === 'http') {
      return this.handleHttp(context, next, startTime);
    }

    // Trata 'rpc' e qualquer outro transporte de microserviço
    return this.handleRpc(context, next, startTime);
  }

  private handleHttp(
    context: ExecutionContext,
    next: CallHandler,
    startTime: number,
  ): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, headers } = request;
    const correlationId = headers['x-correlation-id'];

    this.logger.info(`Incoming request: ${method} ${url}`, {
      correlationId,
      method,
      url,
    });

    return next.handle().pipe(
      tap(() => {
        const response = context.switchToHttp().getResponse();
        const duration = Date.now() - startTime;
        const statusCode = response.statusCode;

        this.logger.logHttp(method, url, statusCode, duration, {
          correlationId,
        });
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        this.logger.error(
          `Request failed: ${method} ${url}`,
          error.stack,
          {
            correlationId,
            method,
            url,
            duration,
            error: error.message,
          },
        );
        throw error;
      }),
    );
  }

  private handleRpc(
    context: ExecutionContext,
    next: CallHandler,
    startTime: number,
  ): Observable<any> {
    const rpcContext = context.switchToRpc();
    const data = rpcContext.getData();
    const ctx = rpcContext.getContext<{ getPattern?: () => string; pattern?: string }>();
    const raw = ctx?.getPattern?.() ?? ctx?.pattern;
    const eventType =
      typeof raw === 'string' ? raw : (typeof raw === 'object' && raw !== null ? ((raw as any).cmd ?? 'unknown') : 'unknown');

    const correlationId = data?.correlationId;

    this.logger.info(`Incoming RPC: ${eventType}`, {
      correlationId,
      eventType,
    });

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        this.logger.info(`RPC completed: ${eventType}`, {
          correlationId,
          eventType,
          duration,
        });
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        this.logger.error(
          `RPC failed: ${eventType}`,
          error.stack,
          {
            correlationId,
            eventType,
            duration,
            error: error.message,
          },
        );
        throw error;
      }),
    );
  }
}
