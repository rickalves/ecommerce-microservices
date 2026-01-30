import { IOrder, IOrderItem, OrderStatus } from '@ecommerce/shared';

export class Order implements IOrder {
    constructor(
        public id: string,
        public userId: string,
        public items: IOrderItem[],
        public totalAmount: number,
        public status: OrderStatus,
        public createdAt: Date,
        public updatedAt: Date
    ) {}

    static create(userId: string, items: IOrderItem[]): Order {
        const totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

        return new Order(
            crypto.randomUUID(),
            userId,
            items,
            totalAmount,
            OrderStatus.PENDING,
            new Date(),
            new Date()
        );
    }

    confirm(): void {
        if (this.status !== OrderStatus.PENDING) {
            throw new Error('Only pending orders can be confirmed');
        }
        this.status = OrderStatus.CONFIRMED;
        this.updatedAt = new Date();
    }

    cancel(): void {
        if (this.status === OrderStatus.DELIVERED) {
            throw new Error('Delivered orders cannot be cancelled');
        }
        this.status = OrderStatus.CANCELLED;
        this.updatedAt = new Date();
    }

    ship(): void {
        if (this.status !== OrderStatus.CONFIRMED) {
            throw new Error('Only confirmed orders can be shipped');
        }
        this.status = OrderStatus.SHIPPED;
        this.updatedAt = new Date();
    }

    deliver(): void {
        if (this.status !== OrderStatus.SHIPPED) {
            throw new Error('Only shipped orders can be delivered');
        }
        this.status = OrderStatus.DELIVERED;
        this.updatedAt = new Date();
    }
}
