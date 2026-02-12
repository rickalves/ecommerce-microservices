import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { CorrelationService } from './correlation.service';

@Injectable()
export class CorrelationInterceptor implements NestInterceptor {
  constructor(private readonly correlationService: CorrelationService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const contextType = context.getType();

    if (contextType === 'rpc') {
      return this.handleRpc(context, next);
    }

    return next.handle();
  }

  private handleRpc(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<any> {
    const rpcContext = context.switchToRpc();
    const data = rpcContext.getData();

    // Extrair contexto de correlação do payload do evento/mensagem
    const correlationId =
      data?.correlationId || this.correlationService.generateCorrelationId();
    const causationId = data?.causationId;
    const traceId = data?.traceId;
    const spanId = data?.spanId;
    const userId = data?.userId || data?.metadata?.userId;

    // Executar handler dentro do contexto de correlação
    return new Observable((subscriber) => {
      this.correlationService.run(
        {
          correlationId,
          causationId,
          traceId,
          spanId,
          userId,
        },
        () => {
          next.handle().subscribe({
            next: (value) => subscriber.next(value),
            error: (error) => subscriber.error(error),
            complete: () => subscriber.complete(),
          });
        },
      );
    });
  }
}
