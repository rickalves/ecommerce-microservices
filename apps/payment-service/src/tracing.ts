// IMPORTANTE: Este arquivo deve ser importado como PRIMEIRA linha do main.ts
// O OTel SDK precisa ser inicializado antes de qualquer import de módulos Node.js
// para que a auto-instrumentação (http, pg, amqplib) funcione corretamente.
import { createOtelSDK } from '@ecommerce/observability';

const sdk = createOtelSDK(process.env.SERVICE_NAME ?? 'payment-service');

sdk.start();

process.on('SIGTERM', () => sdk.shutdown().catch(console.error));
process.on('SIGINT', () => sdk.shutdown().catch(console.error));
