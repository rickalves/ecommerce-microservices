export interface IJwtPayload {
    sub: string; // userId
    email: string;
    iat?: number;
    exp?: number;
}
