import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModule } from './user.module';
import { dataSourceOptions } from './infrastructure/database/data-source';

@Module({
    imports: [TypeOrmModule.forRoot(dataSourceOptions), UserModule],
})
export class AppModule {}
