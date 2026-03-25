import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { PaymentEntity } from './entities/payment.entity';
import { OutboxEntity } from './entities/outbox.entity';

export const dataSourceOptions: DataSourceOptions = {
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'payment_service',
    password: process.env.DB_PASSWORD || 'payment_service_pass',
    database: process.env.DB_DATABASE || 'payments_db',
    entities: [PaymentEntity, OutboxEntity],
    migrations: [__dirname + '/migrations/*{.ts,.js}'],
    synchronize: true,
    logging: process.env.NODE_ENV === 'development',
};

const dataSource = new DataSource(dataSourceOptions);
export default dataSource;
