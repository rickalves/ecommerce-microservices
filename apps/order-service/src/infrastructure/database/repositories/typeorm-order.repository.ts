import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
    IOrderRepository,
    OutboxEntry,
} from '../../../domain/repositories/order.repository.interface';
import { Order } from '../../../domain/entities/order.entity';
import { OrderEntity } from '../entities/order.entity';
import { OutboxEntity } from '../entities/outbox.entity';

@Injectable()
export class TypeOrmOrderRepository implements IOrderRepository {
    constructor(
        @InjectRepository(OrderEntity)
        private readonly orderRepository: Repository<OrderEntity>
    ) {}

    async save(order: Order): Promise<Order> {
        const orderEntity = this.domainToEntity(order);
        const savedEntity = await this.orderRepository.save(orderEntity);
        return this.entityToDomain(savedEntity);
    }

    async saveWithOutbox(order: Order, outbox: OutboxEntry): Promise<Order> {
        const orderEntity = this.domainToEntity(order);
        return this.orderRepository.manager.transaction(async (em) => {
            const saved = await em.save(OrderEntity, orderEntity);
            await em.save(OutboxEntity, {
                eventType: outbox.eventType,
                payload: outbox.payload,
                status: 'PENDING',
                attempts: 0,
                lastError: null,
                publishedAt: null,
            });
            return this.entityToDomain(saved);
        });
    }

    async findById(id: string): Promise<Order | null> {
        const orderEntity = await this.orderRepository.findOne({ where: { id } });
        return orderEntity ? this.entityToDomain(orderEntity) : null;
    }

    async findByUserId(userId: string): Promise<Order[]> {
        const orderEntities = await this.orderRepository.find({ where: { userId } });
        return orderEntities.map((entity) => this.entityToDomain(entity));
    }

    async findAll(): Promise<Order[]> {
        const orderEntities = await this.orderRepository.find();
        return orderEntities.map((entity) => this.entityToDomain(entity));
    }

    async delete(id: string): Promise<void> {
        await this.orderRepository.delete(id);
    }

    private domainToEntity(order: Order): OrderEntity {
        const entity = new OrderEntity();
        entity.id = order.id;
        entity.userId = order.userId;
        entity.items = order.items;
        entity.totalAmount = order.totalAmount;
        entity.status = order.status;
        entity.createdAt = order.createdAt;
        entity.updatedAt = order.updatedAt;
        return entity;
    }

    private entityToDomain(entity: OrderEntity): Order {
        return new Order(
            entity.id,
            entity.userId,
            entity.items,
            entity.totalAmount,
            entity.status,
            entity.createdAt,
            entity.updatedAt
        );
    }
}
