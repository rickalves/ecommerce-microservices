import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const contextType = context.getType();
    const startTime = Date.now();

    if (contextType === 'http') {
      return this.handleHttp(context, next, startTime);
    }

    // Trata 'rpc' e qualquer outro transporte de microserviço (amqp, redis, tcp, etc.)
    return this.handleRpc(context, next, startTime);
  }

  private handleHttp(
    context: ExecutionContext,
    next: CallHandler,
    startTime: number,
  ): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, route, url } = request;
    const routePath: string = route?.path ?? url;

    const record = (statusCode: string) => {
      const duration = (Date.now() - startTime) / 1000;
      this.metrics.httpRequestDuration.observe(
        { method, route: routePath, status_code: statusCode },
        duration,
      );
      this.metrics.httpRequestsTotal.inc({
        method,
        route: routePath,
        status_code: statusCode,
      });
    };

    return next.handle().pipe(
      tap(() => {
        const response = context.switchToHttp().getResponse();
        record(String(response.statusCode));
      }),
      catchError((error) => {
        record(String(error.status ?? 500));
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
    const ctx = rpcContext.getContext<{ getPattern?: () => string; pattern?: string }>();
    // RmqContext expõe getPattern(); TcpContext expõe .pattern diretamente
    const raw = ctx?.getPattern?.() ?? ctx?.pattern;
    const eventType =
      typeof raw === 'string' ? raw : (typeof raw === 'object' && raw !== null ? ((raw as any).cmd ?? 'unknown') : 'unknown');

    return next.handle().pipe(
      tap(() => {
        const duration = (Date.now() - startTime) / 1000;
        this.metrics.eventConsumedTotal.inc({
          event_type: eventType,
          status: 'success',
        });
        this.metrics.eventProcessingDuration.observe(
          { event_type: eventType },
          duration,
        );
      }),
      catchError((error) => {
        const duration = (Date.now() - startTime) / 1000;
        this.metrics.eventConsumedTotal.inc({
          event_type: eventType,
          status: 'error',
        });
        this.metrics.eventProcessingDuration.observe(
          { event_type: eventType },
          duration,
        );
        throw error;
      }),
    );
  }
}
