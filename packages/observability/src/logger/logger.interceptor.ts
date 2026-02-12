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

    if (contextType === 'rpc') {
      return this.handleRpc(context, next, startTime);
    }

    return next.handle();
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
    const pattern = rpcContext.getContext().pattern;
    const eventType = typeof pattern === 'string' ? pattern : pattern?.cmd;

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
