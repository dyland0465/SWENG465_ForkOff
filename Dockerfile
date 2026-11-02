FROM node:22-alpine AS frontend-build

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./

# Public Vite settings are compiled into the frontend, not read at runtime.
# Defaults keep real production disabled, even if only the demo flag is changed.
ARG VITE_APP_ENV=production
ARG VITE_ENABLE_PARTNER_DEMO=false
ENV VITE_APP_ENV=$VITE_APP_ENV
ENV VITE_ENABLE_PARTNER_DEMO=$VITE_ENABLE_PARTNER_DEMO
RUN npm run build

FROM node:22-alpine

# The deployment platform uses curl for its HTTP healthcheck.
RUN apk add --no-cache curl

WORKDIR /app/backend

# Install dependencies from the backend lockfile for reproducible deployments.
COPY backend/package*.json ./
RUN npm ci

# Copy the backend source after installing dependencies to keep Docker layer
# caching effective when only application code changes.
COPY backend/ ./
COPY --from=frontend-build /app/frontend/dist /app/frontend/dist

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# The project currently runs its TypeScript entrypoint through tsx.
CMD ["npx", "tsx", "src/server.ts"]
