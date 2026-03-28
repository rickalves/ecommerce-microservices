import { User } from '../user.entity';
import { PasswordService } from '../../services/password.service';

const makeUser = () => User.create('João Silva', 'joao@example.com', 'hashed_pw');

describe('User', () => {
    describe('User.create', () => {
        it('deve criar usuário com os dados fornecidos', () => {
            const user = User.create('Maria', 'maria@example.com', 'pw123');

            expect(user.name).toBe('Maria');
            expect(user.email).toBe('maria@example.com');
            expect(user.password).toBe('pw123');
        });

        it('deve gerar um id único', () => {
            const a = User.create('A', 'a@a.com', 'pw');
            const b = User.create('B', 'b@b.com', 'pw');

            expect(a.id).not.toBe(b.id);
        });

        it('deve definir createdAt e updatedAt como datas válidas', () => {
            const before = new Date();
            const user = makeUser();
            const after = new Date();

            expect(user.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
            expect(user.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
            expect(user.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
        });
    });

    describe('updateName', () => {
        it('deve atualizar o nome e o updatedAt', () => {
            const user = makeUser();
            const prevUpdatedAt = user.updatedAt;

            user.updateName('Novo Nome');

            expect(user.name).toBe('Novo Nome');
            expect(user.updatedAt.getTime()).toBeGreaterThanOrEqual(prevUpdatedAt.getTime());
        });
    });

    describe('updateEmail', () => {
        it('deve atualizar o email e o updatedAt', () => {
            const user = makeUser();

            user.updateEmail('novo@example.com');

            expect(user.email).toBe('novo@example.com');
        });
    });

    describe('validatePassword', () => {
        it('deve retornar true quando a senha é válida', async () => {
            const user = makeUser();
            const passwordService = {
                compare: jest.fn().mockResolvedValue(true),
            } as unknown as PasswordService;

            const result = await user.validatePassword('plain', passwordService);

            expect(result).toBe(true);
            expect(passwordService.compare).toHaveBeenCalledWith('plain', 'hashed_pw');
        });

        it('deve retornar false quando a senha é inválida', async () => {
            const user = makeUser();
            const passwordService = {
                compare: jest.fn().mockResolvedValue(false),
            } as unknown as PasswordService;

            const result = await user.validatePassword('wrong', passwordService);

            expect(result).toBe(false);
        });
    });
});
