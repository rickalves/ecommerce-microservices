import { Order } from '../entities/order.entity';

export interface OutboxEntry {
    eventType: string;
    payload: Record<string, unknown>;
}

export interface IOrderRepository {
    save(order: Order): Promise<Order>;
    saveWithOutbox(order: Order, outbox: OutboxEntry): Promise<Order>;
    findById(id: string): Promise<Order | null>;
    findByUserId(userId: string): Promise<Order[]>;
    findAll(): Promise<Order[]>;
    delete(id: string): Promise<void>;
}

export const ORDER_REPOSITORY = Symbol('ORDER_REPOSITORY');
