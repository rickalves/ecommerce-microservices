import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IPaymentRepository } from '../../../domain/repositories/payment.repository.interface';
import { Payment } from '../../../domain/entities/payment.entity';
import { PaymentEntity } from '../entities/payment.entity';

@Injectable()
export class TypeOrmPaymentRepository implements IPaymentRepository {
    constructor(
        @InjectRepository(PaymentEntity)
        private readonly paymentRepository: Repository<PaymentEntity>
    ) {}

    async save(payment: Payment): Promise<Payment> {
        const paymentEntity = this.domainToEntity(payment);
        const savedEntity = await this.paymentRepository.save(paymentEntity);
        return this.entityToDomain(savedEntity);
    }

    async findById(id: string): Promise<Payment | null> {
        const paymentEntity = await this.paymentRepository.findOne({ where: { id } });
        return paymentEntity ? this.entityToDomain(paymentEntity) : null;
    }

    async findByOrderId(orderId: string): Promise<Payment | null> {
        const paymentEntity = await this.paymentRepository.findOne({ where: { orderId } });
        return paymentEntity ? this.entityToDomain(paymentEntity) : null;
    }

    async findByUserId(userId: string): Promise<Payment[]> {
        const paymentEntities = await this.paymentRepository.find({ where: { userId } });
        return paymentEntities.map((entity) => this.entityToDomain(entity));
    }

    async findAll(): Promise<Payment[]> {
        const paymentEntities = await this.paymentRepository.find();
        return paymentEntities.map((entity) => this.entityToDomain(entity));
    }

    async delete(id: string): Promise<void> {
        await this.paymentRepository.delete(id);
    }

    private domainToEntity(payment: Payment): PaymentEntity {
        const entity = new PaymentEntity();
        entity.id = payment.id;
        entity.orderId = payment.orderId;
        entity.userId = payment.userId;
        entity.amount = payment.amount;
        entity.status = payment.status;
        entity.method = payment.method;
        entity.transactionId = payment.transactionId;
        entity.createdAt = payment.createdAt;
        entity.updatedAt = payment.updatedAt;
        return entity;
    }

    private entityToDomain(entity: PaymentEntity): Payment {
        return new Payment(
            entity.id,
            entity.orderId,
            entity.userId,
            entity.amount,
            entity.status,
            entity.method,
            entity.createdAt,
            entity.updatedAt,
            entity.transactionId
        );
    }
}
