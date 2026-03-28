import { OrderStatus } from '@ecommerce/shared';
import { Order } from '../order.entity';

const makeItems = () => [
    { productId: 'prod-1', quantity: 2, price: 50 },
    { productId: 'prod-2', quantity: 1, price: 100 },
];

describe('Order', () => {
    describe('Order.create', () => {
        it('deve criar um pedido com status PENDING', () => {
            const order = Order.create('user-1', makeItems());

            expect(order.userId).toBe('user-1');
            expect(order.status).toBe(OrderStatus.PENDING);
        });

        it('deve calcular o totalAmount corretamente', () => {
            const order = Order.create('user-1', makeItems());

            // (2 * 50) + (1 * 100) = 200
            expect(order.totalAmount).toBe(200);
        });

        it('deve gerar um id único', () => {
            const a = Order.create('user-1', makeItems());
            const b = Order.create('user-1', makeItems());

            expect(a.id).not.toBe(b.id);
        });

        it('deve definir createdAt e updatedAt como datas válidas', () => {
            const before = new Date();
            const order = Order.create('user-1', makeItems());
            const after = new Date();

            expect(order.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
            expect(order.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
            expect(order.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
        });
    });

    describe('confirm', () => {
        it('deve mudar status de PENDING para CONFIRMED', () => {
            const order = Order.create('user-1', makeItems());

            order.confirm();

            expect(order.status).toBe(OrderStatus.CONFIRMED);
        });

        it('deve atualizar updatedAt ao confirmar', () => {
            const order = Order.create('user-1', makeItems());
            const before = order.updatedAt;

            order.confirm();

            expect(order.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
        });

        it('deve lançar erro ao confirmar pedido não PENDING', () => {
            const order = Order.create('user-1', makeItems());
            order.confirm(); // CONFIRMED

            expect(() => order.confirm()).toThrow('Only pending orders can be confirmed');
        });
    });

    describe('cancel', () => {
        it('deve cancelar pedido PENDING', () => {
            const order = Order.create('user-1', makeItems());

            order.cancel();

            expect(order.status).toBe(OrderStatus.CANCELLED);
        });

        it('deve cancelar pedido CONFIRMED', () => {
            const order = Order.create('user-1', makeItems());
            order.confirm();

            order.cancel();

            expect(order.status).toBe(OrderStatus.CANCELLED);
        });

        it('deve lançar erro ao cancelar pedido DELIVERED', () => {
            const order = Order.create('user-1', makeItems());
            order.confirm();
            order.ship();
            order.deliver();

            expect(() => order.cancel()).toThrow('Delivered orders cannot be cancelled');
        });
    });

    describe('ship', () => {
        it('deve mudar status de CONFIRMED para SHIPPED', () => {
            const order = Order.create('user-1', makeItems());
            order.confirm();

            order.ship();

            expect(order.status).toBe(OrderStatus.SHIPPED);
        });

        it('deve lançar erro ao enviar pedido não CONFIRMED', () => {
            const order = Order.create('user-1', makeItems()); // PENDING

            expect(() => order.ship()).toThrow('Only confirmed orders can be shipped');
        });
    });

    describe('deliver', () => {
        it('deve mudar status de SHIPPED para DELIVERED', () => {
            const order = Order.create('user-1', makeItems());
            order.confirm();
            order.ship();

            order.deliver();

            expect(order.status).toBe(OrderStatus.DELIVERED);
        });

        it('deve lançar erro ao entregar pedido não SHIPPED', () => {
            const order = Order.create('user-1', makeItems());
            order.confirm();

            expect(() => order.deliver()).toThrow('Only shipped orders can be delivered');
        });
    });
});
