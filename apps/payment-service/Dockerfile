# Dockerfile para Payment Service
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm install -g pnpm && pnpm install --frozen-lockfile
RUN pnpm build
WORKDIR /app/apps/payment-service
EXPOSE 3003
CMD ["node", "dist/main.js"]
