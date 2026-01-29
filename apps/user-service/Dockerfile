# Dockerfile para User Service
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm install -g pnpm && pnpm install --frozen-lockfile
RUN pnpm build
WORKDIR /app/apps/user-service
EXPOSE 3001
CMD ["node", "dist/main.js"]
