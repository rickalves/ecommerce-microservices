import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { HttpService } from '@nestjs/axios';

export interface RabbitMQHealthOptions {
    /** Profundidade máxima de mensagens antes de reportar unhealthy. Padrão: 1000 */
    maxQueueDepth?: number;
    /** Filas específicas a verificar. Padrão: todas as filas. */
    queues?: string[];
}

@Injectable()
export class RabbitMQHealthIndicator extends HealthIndicator {
    private readonly mgmtUrl: string;
    private readonly user: string;
    private readonly pass: string;

    constructor(private readonly http: HttpService) {
        super();
        this.mgmtUrl = process.env.RABBITMQ_MGMT_URL ?? 'http://rabbitmq:15672';
        this.user = process.env.RABBITMQ_USER ?? 'guest';
        this.pass = process.env.RABBITMQ_PASS ?? 'guest';
    }

    async checkQueues(
        key: string,
        options: RabbitMQHealthOptions = {}
    ): Promise<HealthIndicatorResult> {
        const maxDepth = options.maxQueueDepth ?? 1000;

        try {
            const { data } = await this.http.axiosRef.get<RabbitMQQueue[]>(
                `${this.mgmtUrl}/api/queues`,
                {
                    auth: { username: this.user, password: this.pass },
                    timeout: 3000,
                }
            );

            const filtered = options.queues?.length
                ? data.filter((q) => options.queues!.includes(q.name))
                : data;

            const overloaded = filtered.filter((q) => (q.messages ?? 0) > maxDepth);

            if (overloaded.length > 0) {
                const details = Object.fromEntries(
                    overloaded.map((q) => [q.name, { messages: q.messages, maxDepth }])
                );
                throw new HealthCheckError(
                    'RabbitMQ queues overloaded',
                    this.getStatus(key, false, details)
                );
            }

            const maxMessages = Math.max(...filtered.map((q) => q.messages ?? 0), 0);
            return this.getStatus(key, true, { queues: filtered.length, maxMessages });
        } catch (err) {
            if (err instanceof HealthCheckError) throw err;
            throw new HealthCheckError(
                'RabbitMQ unreachable',
                this.getStatus(key, false, { error: (err as Error).message })
            );
        }
    }
}

interface RabbitMQQueue {
    name: string;
    messages?: number;
}
