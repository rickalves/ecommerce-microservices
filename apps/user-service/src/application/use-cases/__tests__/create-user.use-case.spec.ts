import { CreateUserUseCase } from '../create-user.use-case';
import { User } from '../../../domain/entities/user.entity';

const userRepoMock = {
    save: jest.fn(),
    findById: jest.fn(),
    findByEmail: jest.fn(),
    findAll: jest.fn(),
    delete: jest.fn(),
};

const passwordServiceMock = {
    hash: jest.fn(),
    compare: jest.fn(),
    isHashed: jest.fn(),
};

const makeDto = () => ({
    name: 'João Silva',
    email: 'joao@example.com',
    password: 'senha123',
});

describe('CreateUserUseCase', () => {
    let useCase: CreateUserUseCase;

    beforeEach(() => {
        jest.clearAllMocks();
        useCase = new CreateUserUseCase(userRepoMock as any, passwordServiceMock as any);
    });

    describe('execute', () => {
        it('deve criar e salvar usuário com senha hasheada', async () => {
            userRepoMock.findByEmail.mockResolvedValue(null);
            passwordServiceMock.hash.mockResolvedValue('$2b$10$hashedpassword');
            const savedUser = User.create(
                'João Silva',
                'joao@example.com',
                '$2b$10$hashedpassword'
            );
            userRepoMock.save.mockResolvedValue(savedUser);

            const result = await useCase.execute(makeDto());

            expect(userRepoMock.findByEmail).toHaveBeenCalledWith('joao@example.com');
            expect(passwordServiceMock.hash).toHaveBeenCalledWith('senha123');
            expect(userRepoMock.save).toHaveBeenCalledTimes(1);
            const savedArg = userRepoMock.save.mock.calls[0][0] as User;
            expect(savedArg.password).toBe('$2b$10$hashedpassword');
            expect(result).toBe(savedUser);
        });

        it('deve lançar erro quando email já está em uso', async () => {
            const existingUser = User.create('Outro', 'joao@example.com', 'pw');
            userRepoMock.findByEmail.mockResolvedValue(existingUser);

            await expect(useCase.execute(makeDto())).rejects.toThrow(
                'User with this email already exists'
            );

            expect(passwordServiceMock.hash).not.toHaveBeenCalled();
            expect(userRepoMock.save).not.toHaveBeenCalled();
        });
    });
});
