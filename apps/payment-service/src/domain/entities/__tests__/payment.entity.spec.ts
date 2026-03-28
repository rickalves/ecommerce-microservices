import { PaymentMethod, PaymentStatus } from '@ecommerce/shared';
import { Payment } from '../payment.entity';

const makePayment = () => Payment.create('order-1', 'user-1', 150, PaymentMethod.CREDIT_CARD);

describe('Payment', () => {
    describe('Payment.create', () => {
        it('deve criar pagamento com status PENDING', () => {
            const payment = makePayment();

            expect(payment.orderId).toBe('order-1');
            expect(payment.userId).toBe('user-1');
            expect(payment.amount).toBe(150);
            expect(payment.method).toBe(PaymentMethod.CREDIT_CARD);
            expect(payment.status).toBe(PaymentStatus.PENDING);
        });

        it('deve gerar um id único', () => {
            const a = makePayment();
            const b = makePayment();

            expect(a.id).not.toBe(b.id);
        });

        it('deve criar sem transactionId', () => {
            const payment = makePayment();

            expect(payment.transactionId).toBeUndefined();
        });
    });

    describe('process', () => {
        it('deve mudar status de PENDING para PROCESSING e registrar transactionId', () => {
            const payment = makePayment();

            payment.process('txn-123');

            expect(payment.status).toBe(PaymentStatus.PROCESSING);
            expect(payment.transactionId).toBe('txn-123');
        });

        it('deve lançar erro ao processar pagamento não PENDING', () => {
            const payment = makePayment();
            payment.process('txn-abc');

            expect(() => payment.process('txn-xyz')).toThrow(
                'Only pending payments can be processed'
            );
        });
    });

    describe('complete', () => {
        it('deve mudar status de PROCESSING para COMPLETED', () => {
            const payment = makePayment();
            payment.process('txn-1');

            payment.complete();

            expect(payment.status).toBe(PaymentStatus.COMPLETED);
        });

        it('deve lançar erro ao completar pagamento não PROCESSING', () => {
            const payment = makePayment(); // PENDING

            expect(() => payment.complete()).toThrow('Only processing payments can be completed');
        });
    });

    describe('fail', () => {
        it('deve marcar pagamento PENDING como FAILED', () => {
            const payment = makePayment();

            payment.fail();

            expect(payment.status).toBe(PaymentStatus.FAILED);
        });

        it('deve marcar pagamento PROCESSING como FAILED', () => {
            const payment = makePayment();
            payment.process('txn-1');

            payment.fail();

            expect(payment.status).toBe(PaymentStatus.FAILED);
        });

        it('deve lançar erro ao falhar pagamento COMPLETED', () => {
            const payment = makePayment();
            payment.process('txn-1');
            payment.complete();

            expect(() => payment.fail()).toThrow(
                'Completed or refunded payments cannot be marked as failed'
            );
        });

        it('deve lançar erro ao falhar pagamento REFUNDED', () => {
            const payment = makePayment();
            payment.process('txn-1');
            payment.complete();
            payment.refund();

            expect(() => payment.fail()).toThrow(
                'Completed or refunded payments cannot be marked as failed'
            );
        });
    });

    describe('refund', () => {
        it('deve mudar status de COMPLETED para REFUNDED', () => {
            const payment = makePayment();
            payment.process('txn-1');
            payment.complete();

            payment.refund();

            expect(payment.status).toBe(PaymentStatus.REFUNDED);
        });

        it('deve lançar erro ao fazer refund de pagamento não COMPLETED', () => {
            const payment = makePayment(); // PENDING

            expect(() => payment.refund()).toThrow('Only completed payments can be refunded');
        });
    });
});
