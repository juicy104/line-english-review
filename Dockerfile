FROM node:22-bookworm-slim AS base

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps

COPY package*.json ./
RUN npm ci

FROM deps AS dev

COPY prisma ./prisma
RUN npx prisma generate

FROM dev AS builder

COPY . .
RUN npm run build

FROM base AS runner

ENV NODE_ENV=production

COPY package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

RUN npm prune --omit=dev

CMD ["npm", "run", "start:prod"]
