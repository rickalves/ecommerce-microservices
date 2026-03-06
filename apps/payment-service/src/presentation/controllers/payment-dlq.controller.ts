import { Controller } from '@nestjs/common';
import { Payload, EventPattern, Ctx, RmqContext } from '@nestjs/microservices';
import type { ConsumeMessage } from 'amqplib';

/**
 * Consumer da Dead Letter Queue do Payment Service.
 * Recebe mensagens que esgotaram as tentativas de retry e registra para análise.
 * Utiliza o pattern 'dlq.message' para não conflitar com handlers do PaymentController.
 */
@Controller()
export class PaymentDlqController {
    @EventPattern('dlq.message')
    async handleDeadLetter(@Payload() data: unknown, @Ctx() context: RmqContext) {
        const channel = context.getChannelRef();
        const msg = context.getMessage() as ConsumeMessage;

        const xDeath = msg.properties.headers?.['x-death'];
        const originalPattern = msg.properties.headers?.['x-original-pattern'];
        const deadReason = msg.properties.headers?.['x-dead-reason'];

        console.error('[PaymentDLQ] Dead letter recebida', {
            originalPattern,
            deadReason,
            payload: data,
            retryHistory: xDeath,
        });

        // ACK para remover da DLQ — a mensagem foi registrada e não será reprocessada
        channel.ack(msg);
    }
}
