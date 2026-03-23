# Let's Vibe It - Backend Server Dockerfile
# Multi-stage build for optimized production image

# Stage 1: Build the application
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev for TypeScript)
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Stage 2: Production image
FROM node:20-alpine AS production

WORKDIR /app

# Install PostgreSQL 17 client for pg_dump (required for database backups)
# Must match or exceed Supabase server version (currently 17.x)
# Configure to prefer IPv4 over IPv6 (fixes Supabase connection issues in Docker)
RUN apk add --no-cache --repository=https://dl-cdn.alpinelinux.org/alpine/edge/main postgresql17-client && \
    echo 'precedence ::ffff:0:0/96 100' >> /etc/gai.conf

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Start the server
CMD ["node", "dist/index.js"]
