import { GetPaymentUseCase } from '../get-payment.use-case';
import { Payment } from '../../../domain/entities/payment.entity';
import { PaymentMethod, PaymentStatus } from '@ecommerce/shared';

const paymentRepoMock = {
    save: jest.fn(),
    saveWithOutbox: jest.fn(),
    findById: jest.fn(),
    findByOrderId: jest.fn(),
    findByUserId: jest.fn(),
    findAll: jest.fn(),
    delete: jest.fn(),
};

const makePayment = (id = 'pay-1') =>
    new Payment(
        id,
        'order-1',
        'user-1',
        200,
        PaymentStatus.COMPLETED,
        PaymentMethod.PIX,
        new Date(),
        new Date(),
        'txn-1'
    );

describe('GetPaymentUseCase', () => {
    let useCase: GetPaymentUseCase;

    beforeEach(() => {
        jest.clearAllMocks();
        useCase = new GetPaymentUseCase(paymentRepoMock as any);
    });

    describe('execute', () => {
        it('deve retornar o pagamento quando encontrado', async () => {
            const payment = makePayment();
            paymentRepoMock.findById.mockResolvedValue(payment);

            const result = await useCase.execute('pay-1');

            expect(paymentRepoMock.findById).toHaveBeenCalledWith('pay-1');
            expect(result).toBe(payment);
        });

        it('deve lançar erro quando pagamento não é encontrado', async () => {
            paymentRepoMock.findById.mockResolvedValue(null);

            await expect(useCase.execute('id-inexistente')).rejects.toThrow('Payment not found');
        });
    });

    describe('getPaymentByOrder', () => {
        it('deve retornar o pagamento pelo orderId', async () => {
            const payment = makePayment();
            paymentRepoMock.findByOrderId.mockResolvedValue(payment);

            const result = await useCase.getPaymentByOrder('order-1');

            expect(paymentRepoMock.findByOrderId).toHaveBeenCalledWith('order-1');
            expect(result).toBe(payment);
        });

        it('deve retornar null quando não há pagamento para o pedido', async () => {
            paymentRepoMock.findByOrderId.mockResolvedValue(null);

            const result = await useCase.getPaymentByOrder('order-sem-pagamento');

            expect(result).toBeNull();
        });
    });

    describe('getPaymentsByUser', () => {
        it('deve retornar os pagamentos do usuário', async () => {
            const payments = [makePayment('pay-1'), makePayment('pay-2')];
            paymentRepoMock.findByUserId.mockResolvedValue(payments);

            const result = await useCase.getPaymentsByUser('user-1');

            expect(paymentRepoMock.findByUserId).toHaveBeenCalledWith('user-1');
            expect(result).toHaveLength(2);
        });
    });

    describe('getAllPayments', () => {
        it('deve retornar todos os pagamentos', async () => {
            const payments = [makePayment('pay-1'), makePayment('pay-2')];
            paymentRepoMock.findAll.mockResolvedValue(payments);

            const result = await useCase.getAllPayments();

            expect(result).toHaveLength(2);
        });
    });
});
