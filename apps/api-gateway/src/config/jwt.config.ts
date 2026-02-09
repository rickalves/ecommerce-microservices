export const jwtConfig = {
    secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key-change-in-production',
    accessTokenExpiration: (process.env.JWT_ACCESS_EXPIRATION || '15m') as string,
    refreshTokenExpiration: (process.env.JWT_REFRESH_EXPIRATION || '7d') as string,
};
