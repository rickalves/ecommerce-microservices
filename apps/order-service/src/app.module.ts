import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderModule } from './order.module';
import { dataSourceOptions } from './infrastructure/database/data-source';

@Module({
    imports: [TypeOrmModule.forRoot(dataSourceOptions), OrderModule],
})
export class AppModule {}
