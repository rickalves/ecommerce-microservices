# Dockerfile para API Gateway
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm install -g pnpm && pnpm install --frozen-lockfile
RUN pnpm build
WORKDIR /app/apps/api-gateway
EXPOSE 3000
CMD ["node", "dist/main.js"]
