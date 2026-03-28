import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { trace, SpanStatusCode, SpanKind } from '@opentelemetry/api';

@Injectable()
export class TracingInterceptor implements NestInterceptor {
    intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
        const tracer = trace.getTracer('nestjs-handler');
        const controllerName = ctx.getClass().name;
        const handlerName = ctx.getHandler().name;
        const spanName = `${controllerName}.${handlerName}`;

        return new Observable((subscriber) => {
            tracer.startActiveSpan(spanName, { kind: SpanKind.INTERNAL }, (span) => {
                next.handle()
                    .pipe(
                        tap(() => {
                            span.setStatus({ code: SpanStatusCode.OK });
                            span.end();
                        }),
                        catchError((err) => {
                            span.recordException(err as Error);
                            span.setStatus({
                                code: SpanStatusCode.ERROR,
                                message: (err as Error).message,
                            });
                            span.end();
                            throw err;
                        })
                    )
                    .subscribe({
                        next: (v) => subscriber.next(v),
                        error: (e) => subscriber.error(e),
                        complete: () => subscriber.complete(),
                    });
            });
        });
    }
}
