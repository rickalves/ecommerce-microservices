import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { UserEntity } from './entities/user.entity';

export const dataSourceOptions: DataSourceOptions = {
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'user_service',
    password: process.env.DB_PASSWORD || 'user_service_pass',
    database: process.env.DB_DATABASE || 'users_db',
    entities: [UserEntity],
    migrations: [__dirname + '/migrations/*{.ts,.js}'],
    synchronize: true,
    logging: process.env.NODE_ENV === 'development',
};

const dataSource = new DataSource(dataSourceOptions);
export default dataSource;
