export interface LogContext {
  timestamp?: string;
  level?: string;
  service: string;
  correlationId?: string;
  traceId?: string;
  spanId?: string;
  userId?: string;
  environment?: string;
  [key: string]: any;
}

export interface BaseEvent<T = any> {
  version: string;
  correlationId: string;
  causationId?: string;
  traceId?: string;
  spanId?: string;
  timestamp: string;
  service: string;
  eventType: string;
  data: T;
  metadata?: Record<string, any>;
}

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
