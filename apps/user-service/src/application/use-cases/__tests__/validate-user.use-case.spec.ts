import { ValidateUserUseCase } from '../validate-user.use-case';
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

const makeHashedUser = () =>
    new User('user-1', 'João', 'joao@example.com', '$2b$10$hashedpassword', new Date(), new Date());

describe('ValidateUserUseCase', () => {
    let useCase: ValidateUserUseCase;

    beforeEach(() => {
        jest.clearAllMocks();
        useCase = new ValidateUserUseCase(userRepoMock as any, passwordServiceMock as any);
    });

    describe('execute', () => {
        it('deve retornar null quando o usuário não existe', async () => {
            userRepoMock.findByEmail.mockResolvedValue(null);

            const result = await useCase.execute('inexistente@example.com', 'qualquer');

            expect(result).toBeNull();
            expect(passwordServiceMock.compare).not.toHaveBeenCalled();
        });

        it('deve retornar o usuário quando senha hasheada é válida', async () => {
            const user = makeHashedUser();
            userRepoMock.findByEmail.mockResolvedValue(user);
            passwordServiceMock.isHashed.mockReturnValue(true);
            passwordServiceMock.compare.mockResolvedValue(true);

            const result = await useCase.execute('joao@example.com', 'senha123');

            expect(passwordServiceMock.isHashed).toHaveBeenCalledWith(user.password);
            expect(passwordServiceMock.compare).toHaveBeenCalledWith('senha123', user.password);
            expect(result).toBe(user);
        });

        it('deve retornar null quando senha hasheada é inválida', async () => {
            const user = makeHashedUser();
            userRepoMock.findByEmail.mockResolvedValue(user);
            passwordServiceMock.isHashed.mockReturnValue(true);
            passwordServiceMock.compare.mockResolvedValue(false);

            const result = await useCase.execute('joao@example.com', 'senhaerrada');

            expect(result).toBeNull();
        });

        it('deve validar senha em texto plano (legacy) e migrar para hash', async () => {
            const user = new User(
                'user-1',
                'João',
                'joao@example.com',
                'plaintextpw',
                new Date(),
                new Date()
            );
            userRepoMock.findByEmail.mockResolvedValue(user);
            passwordServiceMock.isHashed.mockReturnValue(false);
            passwordServiceMock.hash.mockResolvedValue('$2b$10$newhashedpassword');
            userRepoMock.save.mockResolvedValue(user);

            const result = await useCase.execute('joao@example.com', 'plaintextpw');

            expect(passwordServiceMock.hash).toHaveBeenCalledWith('plaintextpw');
            expect(userRepoMock.save).toHaveBeenCalledWith(user);
            expect(user.password).toBe('$2b$10$newhashedpassword');
            expect(result).toBe(user);
        });

        it('deve retornar null para senha plain text incorreta', async () => {
            const user = new User(
                'user-1',
                'João',
                'joao@example.com',
                'senhareal',
                new Date(),
                new Date()
            );
            userRepoMock.findByEmail.mockResolvedValue(user);
            passwordServiceMock.isHashed.mockReturnValue(false);

            const result = await useCase.execute('joao@example.com', 'senhaerrada');

            expect(result).toBeNull();
            expect(userRepoMock.save).not.toHaveBeenCalled();
        });
    });
});
