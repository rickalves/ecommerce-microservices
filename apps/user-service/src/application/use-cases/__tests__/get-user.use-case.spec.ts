import { GetUserUseCase } from '../get-user.use-case';
import { User } from '../../../domain/entities/user.entity';

const userRepoMock = {
    save: jest.fn(),
    findById: jest.fn(),
    findByEmail: jest.fn(),
    findAll: jest.fn(),
    delete: jest.fn(),
};

const makeUser = (id = 'user-1') =>
    new User(id, 'João', 'joao@example.com', '$2b$10$hash', new Date(), new Date());

describe('GetUserUseCase', () => {
    let useCase: GetUserUseCase;

    beforeEach(() => {
        jest.clearAllMocks();
        useCase = new GetUserUseCase(userRepoMock as any);
    });

    describe('execute', () => {
        it('deve retornar o usuário quando encontrado', async () => {
            const user = makeUser();
            userRepoMock.findById.mockResolvedValue(user);

            const result = await useCase.execute('user-1');

            expect(userRepoMock.findById).toHaveBeenCalledWith('user-1');
            expect(result).toBe(user);
        });

        it('deve lançar erro quando usuário não é encontrado', async () => {
            userRepoMock.findById.mockResolvedValue(null);

            await expect(useCase.execute('id-inexistente')).rejects.toThrow('User not found');
        });
    });

    describe('getAllUsers', () => {
        it('deve retornar todos os usuários', async () => {
            const users = [makeUser('user-1'), makeUser('user-2')];
            userRepoMock.findAll.mockResolvedValue(users);

            const result = await useCase.getAllUsers();

            expect(userRepoMock.findAll).toHaveBeenCalledTimes(1);
            expect(result).toHaveLength(2);
        });
    });
});
