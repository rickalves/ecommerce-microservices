# Dockerfile para Order Service
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm install -g pnpm && pnpm install --frozen-lockfile
RUN pnpm build
WORKDIR /app/apps/order-service
EXPOSE 3002
CMD ["node", "dist/main.js"]
