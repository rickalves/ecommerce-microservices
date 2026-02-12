import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { CorrelationService } from './correlation.service';

@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  constructor(private readonly correlationService: CorrelationService) {}

  use(req: Request, res: Response, next: NextFunction) {
    // Extrair headers de correlação
    const correlationId =
      req.headers['x-correlation-id'] as string ||
      this.correlationService.generateCorrelationId();

    const traceId = req.headers['traceparent'] as string;
    const userId = (req as any).user?.id; // Se existir JWT user

    // Adicionar correlationId ao response header
    res.setHeader('X-Correlation-ID', correlationId);

    // Executar a requisição dentro do contexto de correlação
    this.correlationService.run(
      {
        correlationId,
        traceId,
        userId,
      },
      () => {
        next();
      },
    );
  }
}
