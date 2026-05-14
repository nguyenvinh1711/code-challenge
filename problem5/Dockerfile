# syntax=docker/dockerfile:1.7

# ---------- 1. deps: full dep tree, cached by package*.json ----------
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---------- 2. build: compile TS -> dist/ ----------
FROM node:24-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json tsconfig.json tsconfig.build.json ./
COPY problem5 ./problem5
RUN npx tsc -p tsconfig.build.json

# ---------- 3. prod-deps: production-only node_modules ----------
FROM node:24-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ---------- 4. runtime: minimal image ----------
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# wget is used by the compose healthcheck; busybox in alpine already provides it.
RUN addgroup -S app && adduser -S app -G app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build     /app/dist          ./dist
COPY --from=build     /app/problem5/migrations ./dist/problem5/migrations
COPY package.json ./
USER app
EXPOSE 3000
CMD ["node", "dist/problem5/src/index.js"]
