import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IOrderRepository } from '../../../domain/repositories/order.repository.interface';
import { Order } from '../../../domain/entities/order.entity';
import { OrderEntity } from '../entities/order.entity';

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
