# Base stage
FROM node:24-alpine AS base
WORKDIR /app
COPY package*.json ./

# Development stage (used for local containerized development with hot-reload)
FROM base AS development
ENV NODE_ENV=development
ARG DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL}
RUN npm ci
COPY . .
RUN npx prisma generate
EXPOSE 3000
CMD ["npm", "run", "start:dev"]

# Build stage
FROM base AS builder
ARG DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL}
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

# Production runner stage
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./

EXPOSE 3000
CMD ["node", "dist/main.js"]
