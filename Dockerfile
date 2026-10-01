FROM node:22-alpine

WORKDIR /app/backend

# Install dependencies from the backend lockfile for reproducible deployments.
COPY backend/package*.json ./
RUN npm ci

# Copy the backend source after installing dependencies to keep Docker layer
# caching effective when only application code changes.
COPY backend/ ./

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# The project currently runs its TypeScript entrypoint through tsx.
CMD ["npx", "tsx", "src/server.ts"]
