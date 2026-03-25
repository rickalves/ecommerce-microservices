import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { trace } from '@opentelemetry/api';

@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
    use(req: Request, res: Response, next: NextFunction) {
        // O OTel HttpInstrumentation (via getNodeAutoInstrumentations) já criou o span
        // e propagou o traceparent dos headers de entrada automaticamente.
        // Este middleware apenas expõe o traceId OTel como X-Correlation-ID na resposta.
        const span = trace.getActiveSpan();
        if (span) {
            const traceId = span.spanContext().traceId;
            res.setHeader('X-Correlation-ID', traceId);
            res.setHeader('X-Trace-ID', traceId);

            // Propaga userId do JWT para o span ativo, se disponível
            const userId = (req as any).user?.id;
            if (userId) {
                span.setAttribute('enduser.id', String(userId));
            }
        }
        next();
    }
}
