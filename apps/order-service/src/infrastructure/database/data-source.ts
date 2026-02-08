import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { OrderEntity } from './entities/order.entity';

export const dataSourceOptions: DataSourceOptions = {
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'order_service',
    password: process.env.DB_PASSWORD || 'order_service_pass',
    database: process.env.DB_DATABASE || 'orders_db',
    entities: [OrderEntity],
    migrations: [__dirname + '/migrations/*{.ts,.js}'],
    synchronize: false,
    logging: process.env.NODE_ENV === 'development',
};

const dataSource = new DataSource(dataSourceOptions);
export default dataSource;
