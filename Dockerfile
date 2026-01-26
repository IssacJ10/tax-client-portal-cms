# Strapi Dockerfile for Cloud Run
FROM node:20-alpine

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy application source
COPY . .

# Build Strapi admin panel
RUN npm run build

# Remove dev dependencies to reduce image size
RUN npm prune --production

# Expose Strapi port
EXPOSE 1337

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:1337/_health || exit 1

# Start Strapi
CMD ["npm", "run", "start"]
