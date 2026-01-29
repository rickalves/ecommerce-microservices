import { IUser } from '@ecommerce/shared';

export class User implements IUser {
  constructor(
    public id: string,
    public name: string,
    public email: string,
    public password: string,
    public createdAt: Date,
    public updatedAt: Date,
  ) {}

  updateName(name: string): void {
    this.name = name;
    this.updatedAt = new Date();
  }

  updateEmail(email: string): void {
    this.email = email;
    this.updatedAt = new Date();
  }

  static create(name: string, email: string, password: string): User {
    return new User(crypto.randomUUID(), name, email, password, new Date(), new Date());
  }
}
