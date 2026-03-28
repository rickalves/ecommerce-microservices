import { ProcessPaymentUseCase } from '../process-payment.use-case';
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

const metricsMock = {
    eventPublishedTotal: { inc: jest.fn() },
    paymentsProcessedTotal: { inc: jest.fn() },
};

const makeDto = () => ({
    orderId: 'order-1',
    userId: 'user-1',
    amount: 200,
    method: PaymentMethod.CREDIT_CARD,
});

describe('ProcessPaymentUseCase', () => {
    let useCase: ProcessPaymentUseCase;

    beforeEach(() => {
        jest.clearAllMocks();
        useCase = new ProcessPaymentUseCase(paymentRepoMock as any, metricsMock as any);
    });

    afterEach(() => {
        jest.spyOn(global.Math, 'random').mockRestore();
    });

    describe('execute', () => {
        it('deve lançar erro quando já existe pagamento para o pedido', async () => {
            const existingPayment = Payment.create('order-1', 'user-1', 200, PaymentMethod.PIX);
            paymentRepoMock.findByOrderId.mockResolvedValue(existingPayment);

            await expect(useCase.execute(makeDto())).rejects.toThrow(
                'Payment already exists for this order'
            );

            expect(paymentRepoMock.saveWithOutbox).not.toHaveBeenCalled();
        });

        it('deve criar pagamento, publicar payment.initiated e completar (sucesso simulado)', async () => {
            // Garante sucesso = Math.random() > 0.1 → true
            jest.spyOn(global.Math, 'random').mockReturnValue(0.5);

            paymentRepoMock.findByOrderId.mockResolvedValue(null);

            const pendingPayment = Payment.create(
                'order-1',
                'user-1',
                200,
                PaymentMethod.CREDIT_CARD
            );
            paymentRepoMock.saveWithOutbox.mockResolvedValue(pendingPayment);
            paymentRepoMock.save.mockResolvedValue(pendingPayment);

            await useCase.execute(makeDto());

            // Deve ter chamado saveWithOutbox 2x: payment.initiated e payment.completed
            const outboxCalls = paymentRepoMock.saveWithOutbox.mock.calls;
            expect(outboxCalls[0][1].eventType).toBe('payment.initiated');
            expect(outboxCalls[1][1].eventType).toBe('payment.completed');

            expect(metricsMock.paymentsProcessedTotal.inc).toHaveBeenCalledWith({
                status: 'completed',
            });
        });

        it('deve criar pagamento e registrar falha quando simulação retorna insucesso', async () => {
            // Garante falha = Math.random() <= 0.1 → false para isSuccess
            jest.spyOn(global.Math, 'random').mockReturnValue(0.05);

            paymentRepoMock.findByOrderId.mockResolvedValue(null);

            const pendingPayment = Payment.create(
                'order-1',
                'user-1',
                200,
                PaymentMethod.CREDIT_CARD
            );
            paymentRepoMock.saveWithOutbox.mockResolvedValue(pendingPayment);
            paymentRepoMock.save.mockResolvedValue(pendingPayment);

            await useCase.execute(makeDto());

            const outboxCalls = paymentRepoMock.saveWithOutbox.mock.calls;
            expect(outboxCalls[0][1].eventType).toBe('payment.initiated');
            expect(outboxCalls[1][1].eventType).toBe('payment.failed');

            expect(metricsMock.paymentsProcessedTotal.inc).toHaveBeenCalledWith({
                status: 'failed',
            });
        });

        it('deve publicar payment.initiated com o payload correto', async () => {
            jest.spyOn(global.Math, 'random').mockReturnValue(0.5);

            paymentRepoMock.findByOrderId.mockResolvedValue(null);
            const pendingPayment = Payment.create(
                'order-1',
                'user-1',
                200,
                PaymentMethod.CREDIT_CARD
            );
            paymentRepoMock.saveWithOutbox.mockResolvedValue(pendingPayment);
            paymentRepoMock.save.mockResolvedValue(pendingPayment);

            await useCase.execute(makeDto());

            const [paymentArg, outboxArg] = paymentRepoMock.saveWithOutbox.mock.calls[0];
            expect(outboxArg.eventType).toBe('payment.initiated');
            // correlationId é o id do payment criado dentro do use-case
            expect((outboxArg.payload as any).correlationId).toBe(paymentArg.id);
        });
    });
});
