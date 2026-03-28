import { CreateOrderUseCase } from '../create-order.use-case';
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

const metricsMock = {
    ordersCreatedTotal: { inc: jest.fn() },
    eventPublishedTotal: { inc: jest.fn() },
};

const makeDto = () => ({
    userId: 'user-1',
    items: [
        { productId: 'prod-1', quantity: 2, price: 50 },
        { productId: 'prod-2', quantity: 1, price: 100 },
    ],
});

describe('CreateOrderUseCase', () => {
    let useCase: CreateOrderUseCase;

    beforeEach(() => {
        jest.clearAllMocks();
        useCase = new CreateOrderUseCase(orderRepoMock as any, metricsMock as any);
    });

    describe('execute', () => {
        it('deve criar e salvar um pedido no outbox com status PENDING', async () => {
            const dto = makeDto();
            const savedOrder = Order.create(dto.userId, dto.items);
            orderRepoMock.saveWithOutbox.mockResolvedValue(savedOrder);

            const result = await useCase.execute(dto);

            expect(orderRepoMock.saveWithOutbox).toHaveBeenCalledTimes(1);
            const [orderArg, outboxArg] = orderRepoMock.saveWithOutbox.mock.calls[0];
            expect(orderArg.userId).toBe(dto.userId);
            expect(orderArg.status).toBe(OrderStatus.PENDING);
            expect(orderArg.totalAmount).toBe(200);
            expect(outboxArg.eventType).toBe('order.created.accepted');
            expect(result).toBe(savedOrder);
        });

        it('deve incrementar as métricas de pedido criado e evento publicado', async () => {
            const dto = makeDto();
            orderRepoMock.saveWithOutbox.mockResolvedValue(Order.create(dto.userId, dto.items));

            await useCase.execute(dto);

            expect(metricsMock.ordersCreatedTotal.inc).toHaveBeenCalledTimes(1);
            expect(metricsMock.eventPublishedTotal.inc).toHaveBeenCalledWith({
                event_type: 'order.created.accepted',
            });
        });
    });
});
