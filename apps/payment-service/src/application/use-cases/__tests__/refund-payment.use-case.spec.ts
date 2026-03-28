import { RefundPaymentUseCase } from '../refund-payment.use-case';
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

const eventBusMock = {
    emit: jest.fn(),
};

const makeCompletedPayment = () =>
    new Payment(
        'pay-1',
        'order-1',
        'user-1',
        200,
        PaymentStatus.COMPLETED,
        PaymentMethod.CREDIT_CARD,
        new Date(),
        new Date(),
        'txn-1'
    );

describe('RefundPaymentUseCase', () => {
    let useCase: RefundPaymentUseCase;

    beforeEach(() => {
        jest.clearAllMocks();
        useCase = new RefundPaymentUseCase(paymentRepoMock as any, eventBusMock as any);
    });

    describe('execute', () => {
        it('deve fazer refund de um pagamento COMPLETED e publicar evento', async () => {
            const payment = makeCompletedPayment();
            paymentRepoMock.findById.mockResolvedValue(payment);
            paymentRepoMock.save.mockResolvedValue(payment);

            const result = await useCase.execute('pay-1');

            expect(payment.status).toBe(PaymentStatus.REFUNDED);
            expect(paymentRepoMock.save).toHaveBeenCalledWith(payment);
            expect(eventBusMock.emit).toHaveBeenCalledWith(
                'payment.refunded',
                expect.objectContaining({
                    correlationId: payment.id,
                    orderId: payment.orderId,
                })
            );
        });

        it('deve lançar erro quando pagamento não é encontrado', async () => {
            paymentRepoMock.findById.mockResolvedValue(null);

            await expect(useCase.execute('id-inexistente')).rejects.toThrow('Payment not found');

            expect(paymentRepoMock.save).not.toHaveBeenCalled();
            expect(eventBusMock.emit).not.toHaveBeenCalled();
        });

        it('deve lançar erro ao tentar refund de pagamento não COMPLETED', async () => {
            const payment = new Payment(
                'pay-1',
                'order-1',
                'user-1',
                200,
                PaymentStatus.PENDING,
                PaymentMethod.PIX,
                new Date(),
                new Date()
            );
            paymentRepoMock.findById.mockResolvedValue(payment);

            await expect(useCase.execute('pay-1')).rejects.toThrow(
                'Only completed payments can be refunded'
            );

            expect(paymentRepoMock.save).not.toHaveBeenCalled();
            expect(eventBusMock.emit).not.toHaveBeenCalled();
        });
    });
});
