import { GetOrderUseCase } from '../get-order.use-case';
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

const makeOrder = (id = 'order-1') =>
    new Order(
        id,
        'user-1',
        [{ productId: 'prod-1', quantity: 1, price: 100 }],
        100,
        OrderStatus.PENDING,
        new Date(),
        new Date()
    );

describe('GetOrderUseCase', () => {
    let useCase: GetOrderUseCase;

    beforeEach(() => {
        jest.clearAllMocks();
        useCase = new GetOrderUseCase(orderRepoMock as any);
    });

    describe('execute', () => {
        it('deve retornar o pedido quando encontrado', async () => {
            const order = makeOrder();
            orderRepoMock.findById.mockResolvedValue(order);

            const result = await useCase.execute('order-1');

            expect(orderRepoMock.findById).toHaveBeenCalledWith('order-1');
            expect(result).toBe(order);
        });

        it('deve lançar erro quando o pedido não é encontrado', async () => {
            orderRepoMock.findById.mockResolvedValue(null);

            await expect(useCase.execute('id-inexistente')).rejects.toThrow('Order not found');
        });
    });

    describe('getOrdersByUser', () => {
        it('deve retornar todos os pedidos do usuário', async () => {
            const orders = [makeOrder('order-1'), makeOrder('order-2')];
            orderRepoMock.findByUserId.mockResolvedValue(orders);

            const result = await useCase.getOrdersByUser('user-1');

            expect(orderRepoMock.findByUserId).toHaveBeenCalledWith('user-1');
            expect(result).toHaveLength(2);
        });
    });

    describe('getAllOrders', () => {
        it('deve retornar todos os pedidos', async () => {
            const orders = [makeOrder('order-1'), makeOrder('order-2')];
            orderRepoMock.findAll.mockResolvedValue(orders);

            const result = await useCase.getAllOrders();

            expect(orderRepoMock.findAll).toHaveBeenCalledTimes(1);
            expect(result).toHaveLength(2);
        });
    });
});
