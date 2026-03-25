import { Injectable } from '@nestjs/common';
import { trace, SpanContext } from '@opentelemetry/api';
import { v4 as uuidv4 } from 'uuid';

export interface CorrelationContext {
    correlationId: string;
    causationId?: string;
    traceId?: string;
    spanId?: string;
    userId?: string;
    [key: string]: any;
}

@Injectable()
export class CorrelationService {
    /**
     * Obtém o traceId do span OTel ativo — equivale ao correlationId.
     * O OTel SDK usa AsyncLocalStorage internamente, não precisamos gerenciá-lo.
     */
    getCorrelationId(): string | undefined {
        return this.getActiveSpanContext()?.traceId;
    }

    getTraceId(): string | undefined {
        return this.getActiveSpanContext()?.traceId;
    }

    getSpanId(): string | undefined {
        return this.getActiveSpanContext()?.spanId;
    }

    getContext(): CorrelationContext | undefined {
        const spanCtx = this.getActiveSpanContext();
        if (!spanCtx) return undefined;
        return {
            correlationId: spanCtx.traceId,
            traceId: spanCtx.traceId,
            spanId: spanCtx.spanId,
        };
    }

    /** Mantido para compatibilidade com CorrelationMiddleware */
    generateCorrelationId(): string {
        return uuidv4();
    }

    private getActiveSpanContext(): SpanContext | undefined {
        const span = trace.getActiveSpan();
        if (!span) return undefined;
        const ctx = span.spanContext();
        // traceId '000...0' indica NonRecordingSpan (sem span ativo real)
        return ctx.traceId !== '00000000000000000000000000000000' ? ctx : undefined;
    }

    /** @deprecated AsyncLocalStorage foi substituído pelo OTel SDK */
    get(key: string): any {
        return this.getContext()?.[key];
    }

    /** @deprecated AsyncLocalStorage foi substituído pelo OTel SDK */
    set(_key: string, _value: any): void {
        // no-op: atributos de span devem ser definidos via trace.getActiveSpan().setAttribute()
    }
}
