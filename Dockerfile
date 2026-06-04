# Stage 1: Build
FROM node:20-slim AS builder
ENV NPM_CONFIG_REGISTRY=https://registry.npmmirror.com \
    PRISMA_ENGINES_MIRROR=https://registry.npmmirror.com/-/binary/prisma
RUN sed -i 's/deb.debian.org/mirrors.aliyun.com/g; s/security.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources \
  && apt-get update \
  && apt-get install -y --no-install-recommends openssl python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build
RUN npm prune --omit=dev

# Stage 2: Run
FROM node:20-slim
ENV NPM_CONFIG_REGISTRY=https://registry.npmmirror.com \
    PRISMA_ENGINES_MIRROR=https://registry.npmmirror.com/-/binary/prisma \
    NODE_ENV=production
RUN sed -i 's/deb.debian.org/mirrors.aliyun.com/g; s/security.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources \
  && apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000
CMD ["sh", "-c", "./node_modules/.bin/prisma db push --accept-data-loss && npm run start:prod"]
