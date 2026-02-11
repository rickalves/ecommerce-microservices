import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentModule } from './payment.module';
import { dataSourceOptions } from './infrastructure/database/data-source';

@Module({
    imports: [TypeOrmModule.forRoot(dataSourceOptions), PaymentModule],
})
export class AppModule {}
