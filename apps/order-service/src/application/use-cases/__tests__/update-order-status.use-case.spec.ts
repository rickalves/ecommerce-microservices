import { UpdateOrderStatusUseCase } from '../update-order-status.use-case';
import { Order } from '../../../domain/entities/order.entity';
import { OrderStatus } from '@ecommerce/shared';

const orderRepoMock = {
    save: jest.fn(),
    saveWithOutbox: jest.fn(),
    findById: jest.fn(),
    findByUserId: jest.fn(),
    findAll: jest.fn(),
    delete: jest.fn(),
};

const makeOrder = (status: OrderStatus) =>
    new Order(
        'order-1',
        'user-1',
        [{ productId: 'prod-1', quantity: 1, price: 100 }],
        100,
        status,
        new Date(),
        new Date()
    );

describe('UpdateOrderStatusUseCase', () => {
    let useCase: UpdateOrderStatusUseCase;

    beforeEach(() => {
        jest.clearAllMocks();
        useCase = new UpdateOrderStatusUseCase(orderRepoMock as any);
    });

    describe('confirmOrder', () => {
        it('deve confirmar um pedido PENDING e salvar', async () => {
            const order = makeOrder(OrderStatus.PENDING);
            orderRepoMock.findById.mockResolvedValue(order);
            orderRepoMock.save.mockResolvedValue({ ...order, status: OrderStatus.CONFIRMED });

            const result = await useCase.confirmOrder('order-1');

            expect(order.status).toBe(OrderStatus.CONFIRMED);
            expect(orderRepoMock.save).toHaveBeenCalledWith(order);
        });

        it('deve ser idempotente: retornar pedido já CONFIRMED sem salvar novamente', async () => {
            const order = makeOrder(OrderStatus.CONFIRMED);
            orderRepoMock.findById.mockResolvedValue(order);

            const result = await useCase.confirmOrder('order-1');

            expect(orderRepoMock.save).not.toHaveBeenCalled();
            expect(result).toBe(order);
        });

        it('deve lançar erro quando pedido não encontrado', async () => {
            orderRepoMock.findById.mockResolvedValue(null);

            await expect(useCase.confirmOrder('id-inexistente')).rejects.toThrow('Order not found');
        });
    });

    describe('shipOrder', () => {
        it('deve enviar um pedido CONFIRMED', async () => {
            const order = makeOrder(OrderStatus.CONFIRMED);
            orderRepoMock.findById.mockResolvedValue(order);
            orderRepoMock.save.mockResolvedValue(order);

            await useCase.shipOrder('order-1');

            expect(order.status).toBe(OrderStatus.SHIPPED);
            expect(orderRepoMock.save).toHaveBeenCalledWith(order);
        });

        it('deve lançar erro quando pedido não encontrado', async () => {
            orderRepoMock.findById.mockResolvedValue(null);

            await expect(useCase.shipOrder('id-inexistente')).rejects.toThrow('Order not found');
        });
    });

    describe('deliverOrder', () => {
        it('deve entregar um pedido SHIPPED', async () => {
            const order = makeOrder(OrderStatus.SHIPPED);
            orderRepoMock.findById.mockResolvedValue(order);
            orderRepoMock.save.mockResolvedValue(order);

            await useCase.deliverOrder('order-1');

            expect(order.status).toBe(OrderStatus.DELIVERED);
            expect(orderRepoMock.save).toHaveBeenCalledWith(order);
        });

        it('deve lançar erro quando pedido não encontrado', async () => {
            orderRepoMock.findById.mockResolvedValue(null);

            await expect(useCase.deliverOrder('id-inexistente')).rejects.toThrow('Order not found');
        });
    });

    describe('cancelOrder', () => {
        it('deve cancelar um pedido PENDING e publicar evento no outbox', async () => {
            const order = makeOrder(OrderStatus.PENDING);
            orderRepoMock.findById.mockResolvedValue(order);
            orderRepoMock.saveWithOutbox.mockResolvedValue(order);

            await useCase.cancelOrder('order-1');

            expect(order.status).toBe(OrderStatus.CANCELLED);
            expect(orderRepoMock.saveWithOutbox).toHaveBeenCalledTimes(1);
            const [, outboxArg] = orderRepoMock.saveWithOutbox.mock.calls[0];
            expect(outboxArg.eventType).toBe('order.cancelled');
        });

        it('deve ser idempotente: retornar pedido já CANCELLED sem salvar novamente', async () => {
            const order = makeOrder(OrderStatus.CANCELLED);
            orderRepoMock.findById.mockResolvedValue(order);

            const result = await useCase.cancelOrder('order-1');

            expect(orderRepoMock.save).not.toHaveBeenCalled();
            expect(orderRepoMock.saveWithOutbox).not.toHaveBeenCalled();
            expect(result).toBe(order);
        });

        it('deve lançar erro quando pedido não encontrado', async () => {
            orderRepoMock.findById.mockResolvedValue(null);

            await expect(useCase.cancelOrder('id-inexistente')).rejects.toThrow('Order not found');
        });
    });
});
