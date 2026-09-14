# マルチステージビルド: SPA(web) + API(server) → 1コンテナ
# Cloud Run / ローカル docker compose 共用

# ---- web build ----
FROM node:22-slim AS web-build
WORKDIR /web
COPY web/package*.json ./
RUN npm ci || npm install
COPY web/ ./
RUN npm run build

# ---- server build ----
FROM node:22-slim AS server-build
WORKDIR /app
COPY server/package*.json ./
RUN npm ci || npm install
COPY server/prisma ./prisma
RUN npx prisma generate
COPY server/tsconfig.json ./
COPY server/src ./src
RUN npm run build

# ---- runtime ----
FROM node:22-slim
# Prisma エンジンに必要
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY server/package*.json ./
COPY --from=server-build /app/node_modules ./node_modules
COPY --from=server-build /app/dist ./dist
COPY server/prisma ./prisma
COPY --from=web-build /web/dist ./public

EXPOSE 8080
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
