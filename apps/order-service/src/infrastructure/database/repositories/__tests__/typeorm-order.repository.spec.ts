import { Repository } from 'typeorm';
import { TypeOrmOrderRepository } from '../typeorm-order.repository';
import { Order } from '../../../../domain/entities/order.entity';
import { OrderEntity } from '../../entities/order.entity';
import { OrderStatus } from '@ecommerce/shared';

const makeOrderEntity = (id = 'order-1'): OrderEntity => {
    const entity = new OrderEntity();
    entity.id = id;
    entity.userId = 'user-1';
    entity.items = [{ productId: 'prod-1', quantity: 2, price: 50 }];
    entity.totalAmount = 100;
    entity.status = OrderStatus.PENDING;
    entity.createdAt = new Date('2024-01-01');
    entity.updatedAt = new Date('2024-01-01');
    return entity;
};

const makeDomainOrder = (id = 'order-1'): Order =>
    new Order(
        id,
        'user-1',
        [{ productId: 'prod-1', quantity: 2, price: 50 }],
        100,
        OrderStatus.PENDING,
        new Date('2024-01-01'),
        new Date('2024-01-01')
    );

describe('TypeOrmOrderRepository', () => {
    let repo: TypeOrmOrderRepository;
    let ormRepoMock: jest.Mocked<
        Pick<Repository<OrderEntity>, 'save' | 'findOne' | 'find' | 'delete' | 'manager'>
    >;

    beforeEach(() => {
        const managerMock = {
            transaction: jest.fn(),
        };

        ormRepoMock = {
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            delete: jest.fn(),
            manager: managerMock as any,
        };

        repo = new TypeOrmOrderRepository(ormRepoMock as any);
    });

    describe('save', () => {
        it('deve mapear domínio para entidade, salvar e retornar domínio', async () => {
            const order = makeDomainOrder();
            const entity = makeOrderEntity();
            ormRepoMock.save.mockResolvedValue(entity);

            const result = await repo.save(order);

            expect(ormRepoMock.save).toHaveBeenCalledTimes(1);
            expect(result).toBeInstanceOf(Order);
            expect(result.id).toBe('order-1');
            expect(result.status).toBe(OrderStatus.PENDING);
        });
    });

    describe('findById', () => {
        it('deve retornar Order de domínio quando entidade existe', async () => {
            ormRepoMock.findOne.mockResolvedValue(makeOrderEntity());

            const result = await repo.findById('order-1');

            expect(ormRepoMock.findOne).toHaveBeenCalledWith({ where: { id: 'order-1' } });
            expect(result).toBeInstanceOf(Order);
            expect(result!.id).toBe('order-1');
        });

        it('deve retornar null quando nenhuma entidade encontrada', async () => {
            ormRepoMock.findOne.mockResolvedValue(null);

            const result = await repo.findById('id-inexistente');

            expect(result).toBeNull();
        });
    });

    describe('findByUserId', () => {
        it('deve retornar lista de Orders para o userId', async () => {
            ormRepoMock.find.mockResolvedValue([makeOrderEntity('o1'), makeOrderEntity('o2')]);

            const result = await repo.findByUserId('user-1');

            expect(ormRepoMock.find).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
            expect(result).toHaveLength(2);
            expect(result[0]).toBeInstanceOf(Order);
        });
    });

    describe('findAll', () => {
        it('deve retornar todos os pedidos', async () => {
            ormRepoMock.find.mockResolvedValue([makeOrderEntity('o1'), makeOrderEntity('o2')]);

            const result = await repo.findAll();

            expect(ormRepoMock.find).toHaveBeenCalledTimes(1);
            expect(result).toHaveLength(2);
        });
    });

    describe('delete', () => {
        it('deve chamar delete com o id correto', async () => {
            ormRepoMock.delete.mockResolvedValue({ affected: 1, raw: [] });

            await repo.delete('order-1');

            expect(ormRepoMock.delete).toHaveBeenCalledWith('order-1');
        });
    });

    describe('saveWithOutbox', () => {
        it('deve executar dentro de uma transação e salvar pedido e outbox', async () => {
            const order = makeDomainOrder();
            const entity = makeOrderEntity();

            const emMock = {
                save: jest.fn().mockResolvedValueOnce(entity).mockResolvedValueOnce({}),
            };

            (ormRepoMock.manager.transaction as jest.Mock).mockImplementation(
                (cb: (em: typeof emMock) => Promise<Order>) => cb(emMock)
            );

            const result = await repo.saveWithOutbox(order, {
                eventType: 'order.created.accepted',
                payload: { correlationId: order.id },
            });

            expect(ormRepoMock.manager.transaction).toHaveBeenCalledTimes(1);
            expect(emMock.save).toHaveBeenCalledTimes(2);

            // Primeiro save é o OrderEntity
            expect(emMock.save.mock.calls[0][0]).toBe(OrderEntity);

            // Segundo save é o OutboxEntity
            const outboxArg = emMock.save.mock.calls[1][1];
            expect(outboxArg.eventType).toBe('order.created.accepted');
            expect(outboxArg.status).toBe('PENDING');
            expect(outboxArg.attempts).toBe(0);

            expect(result).toBeInstanceOf(Order);
        });
    });
});
