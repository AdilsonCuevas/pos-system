# Frontend Dockerfile - React 18 + Vite + TypeScript
# Multi-stage build

# =============================================================================
# Base Stage
# =============================================================================
FROM node:20-alpine as base

WORKDIR /app

# Install dependencies for native modules
RUN apk add --no-cache python3 make g++

# =============================================================================
# Dependencies Stage
# =============================================================================
FROM base as deps

COPY package.json ./
RUN npm install --prefer-offline --no-audit --no-fund

# =============================================================================
# Builder Stage
# =============================================================================
FROM deps as builder

COPY . .
RUN npm run build

# =============================================================================
# Production Stage - Nginx (served by Caddy in docker-compose)
# =============================================================================
FROM nginx:alpine as production

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]