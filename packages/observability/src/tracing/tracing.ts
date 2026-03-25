import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { Resource } from '@opentelemetry/resources';
import {
    SEMRESATTRS_SERVICE_NAME,
    SEMRESATTRS_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { AmqplibInstrumentation } from '@opentelemetry/instrumentation-amqplib';

export function createOtelSDK(serviceName: string): NodeSDK {
    return new NodeSDK({
        resource: new Resource({
            [SEMRESATTRS_SERVICE_NAME]: serviceName,
            [SEMRESATTRS_SERVICE_VERSION]: process.env.APP_VERSION ?? '1.0.0',
        }),
        traceExporter: new OTLPTraceExporter({
            url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://otel-collector:4317',
        }),
        instrumentations: [
            getNodeAutoInstrumentations({
                // Desabilita instrumentações muito verbosas
                '@opentelemetry/instrumentation-fs': { enabled: false },
                '@opentelemetry/instrumentation-dns': { enabled: false },
            }),
            new AmqplibInstrumentation(), // Auto-instrumenta RabbitMQ publish/consume
        ],
    });
}
