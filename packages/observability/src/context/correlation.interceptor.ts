import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { trace, context, propagation, SpanKind } from '@opentelemetry/api';

@Injectable()
export class CorrelationInterceptor implements NestInterceptor {
    intercept(executionContext: ExecutionContext, next: CallHandler): Observable<any> {
        if (executionContext.getType() !== 'rpc') {
            return next.handle();
        }

        // O AmqplibInstrumentation já extrai traceparent dos headers AMQP para mensagens
        // instrumentadas automaticamente. Este interceptor cobre payloads legados que
        // carregam traceId/spanId diretamente no corpo do evento.
        const data = executionContext.switchToRpc().getData();
        const tracer = trace.getTracer('correlation-interceptor');

        const carrier: Record<string, string> = {};
        if (data?.traceparent) {
            carrier['traceparent'] = data.traceparent;
        } else if (data?.traceId && data.traceId !== '00000000000000000000000000000000') {
            const spanId = data.spanId ?? '0000000000000001';
            carrier['traceparent'] = `00-${data.traceId}-${spanId}-01`;
        }

        const parentCtx = Object.keys(carrier).length
            ? propagation.extract(context.active(), carrier)
            : context.active();

        const eventType = data?.eventType ?? 'rpc.message';

        return new Observable((subscriber) => {
            tracer.startActiveSpan(
                `consume ${eventType}`,
                { kind: SpanKind.CONSUMER },
                parentCtx,
                (span) => {
                    if (data?.correlationId) {
                        span.setAttribute('messaging.correlation_id', data.correlationId);
                    }
                    if (data?.eventType) {
                        span.setAttribute('messaging.operation', data.eventType);
                    }

                    next.handle().subscribe({
                        next: (value) => subscriber.next(value),
                        error: (err) => {
                            span.recordException(err as Error);
                            span.end();
                            subscriber.error(err);
                        },
                        complete: () => {
                            span.end();
                            subscriber.complete();
                        },
                    });
                }
            );
        });
    }
}
