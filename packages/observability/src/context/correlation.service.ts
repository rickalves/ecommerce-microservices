import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
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
    private static asyncLocalStorage = new AsyncLocalStorage<CorrelationContext>();

    /**
     * Executa uma função dentro de um contexto de correlação
     */
    run<T>(context: Partial<CorrelationContext>, fn: () => T): T {
        const correlationContext: CorrelationContext = {
            correlationId: context.correlationId || uuidv4(),
            ...context,
        };

        return CorrelationService.asyncLocalStorage.run(correlationContext, fn);
    }

    /**
     * Obtém o contexto de correlação atual
     */
    getContext(): CorrelationContext | undefined {
        return CorrelationService.asyncLocalStorage.getStore();
    }

    /**
     * Obtém o correlationId atual
     */
    getCorrelationId(): string | undefined {
        return this.getContext()?.correlationId;
    }

    /**
     * Obtém o traceId atual
     */
    getTraceId(): string | undefined {
        return this.getContext()?.traceId;
    }

    /**
     * Obtém o spanId atual
     */
    getSpanId(): string | undefined {
        return this.getContext()?.spanId;
    }

    /**
     * Obtém o userId atual
     */
    getUserId(): string | undefined {
        return this.getContext()?.userId;
    }

    /**
     * Define uma propriedade no contexto atual
     */
    set(key: string, value: any): void {
        const context = this.getContext();
        if (context) {
            context[key] = value;
        }
    }

    /**
     * Obtém uma propriedade do contexto atual
     */
    get(key: string): any {
        return this.getContext()?.[key];
    }

    /**
     * Gera um novo correlationId
     */
    generateCorrelationId(): string {
        return uuidv4();
    }

    /**
     * Cria um contexto filho com causationId definido
     */
    createChildContext(additionalContext?: Partial<CorrelationContext>): CorrelationContext {
        const currentContext = this.getContext();
        const correlationId = currentContext?.correlationId || uuidv4();

        return {
            correlationId,
            causationId: currentContext?.correlationId,
            ...additionalContext,
        };
    }
}
