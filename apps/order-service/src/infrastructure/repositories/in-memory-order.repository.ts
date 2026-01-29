import { Injectable } from '@nestjs/common';
import { Order } from '../../domain/entities/order.entity';
import { IOrderRepository } from '../../domain/repositories/order.repository.interface';

@Injectable()
export class InMemoryOrderRepository implements IOrderRepository {
  private orders: Map<string, Order> = new Map();

  async save(order: Order): Promise<Order> {
    this.orders.set(order.id, order);
    return order;
  }

  async findById(id: string): Promise<Order | null> {
    return this.orders.get(id) || null;
  }

  async findByUserId(userId: string): Promise<Order[]> {
    const orders = Array.from(this.orders.values());
    return orders.filter((order) => order.userId === userId);
  }

  async findAll(): Promise<Order[]> {
    return Array.from(this.orders.values());
  }

  async delete(id: string): Promise<void> {
    this.orders.delete(id);
  }
}
