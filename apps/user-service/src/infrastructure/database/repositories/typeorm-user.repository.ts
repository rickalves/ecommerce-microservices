import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IUserRepository } from '../../../domain/repositories/user.repository.interface';
import { User } from '../../../domain/entities/user.entity';
import { UserEntity } from '../entities/user.entity';

@Injectable()
export class TypeOrmUserRepository implements IUserRepository {
    constructor(
        @InjectRepository(UserEntity)
        private readonly userRepository: Repository<UserEntity>
    ) {}

    async save(user: User): Promise<User> {
        const userEntity = this.domainToEntity(user);
        const savedEntity = await this.userRepository.save(userEntity);
        return this.entityToDomain(savedEntity);
    }

    async findById(id: string): Promise<User | null> {
        const userEntity = await this.userRepository.findOne({ where: { id } });
        return userEntity ? this.entityToDomain(userEntity) : null;
    }

    async findByEmail(email: string): Promise<User | null> {
        const userEntity = await this.userRepository.findOne({ where: { email } });
        return userEntity ? this.entityToDomain(userEntity) : null;
    }

    async findAll(): Promise<User[]> {
        const userEntities = await this.userRepository.find();
        return userEntities.map((entity) => this.entityToDomain(entity));
    }

    async delete(id: string): Promise<void> {
        await this.userRepository.delete(id);
    }

    private domainToEntity(user: User): UserEntity {
        const entity = new UserEntity();
        entity.id = user.id;
        entity.name = user.name;
        entity.email = user.email;
        entity.password = user.password;
        entity.createdAt = user.createdAt;
        entity.updatedAt = user.updatedAt;
        return entity;
    }

    private entityToDomain(entity: UserEntity): User {
        return new User(
            entity.id,
            entity.name,
            entity.email,
            entity.password,
            entity.createdAt,
            entity.updatedAt
        );
    }
}
