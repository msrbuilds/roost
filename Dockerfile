# syntax=docker/dockerfile:1
# Roost - Frontend Dockerfile
# Multi-stage build for optimized production image

# Stage 0: Pre-build backup (optional)
# Triggers a database backup on the running production server before building
FROM alpine:3.19 AS backup

# Build arguments for backup
ARG BACKUP_API_URL

# Install wget for API calls
RUN apk add --no-cache wget

# Copy and run backup script
COPY scripts/docker-pre-build-backup.sh /backup.sh
RUN chmod +x /backup.sh
RUN --mount=type=secret,id=backup_token \
    BACKUP_API_URL=${BACKUP_API_URL} \
    BACKUP_SECRET_TOKEN=$(cat /run/secrets/backup_token 2>/dev/null || echo "") \
    /backup.sh

# Stage 1: Build the application
FROM node:20-alpine AS builder

# Copy a dummy file from backup stage to ensure it runs first
COPY --from=backup /backup.sh /tmp/backup-completed

WORKDIR /app

# Build arguments for Vite environment variables
ARG VITE_DB_PROVIDER="supabase-cloud"
ARG VITE_DATABASE_URL=""
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_AWS_REGION
ARG VITE_AWS_S3_BUCKET
ARG VITE_APP_NAME="Roost"
ARG VITE_APP_URL
ARG VITE_API_URL

# Set environment variables for build
ENV VITE_DB_PROVIDER=$VITE_DB_PROVIDER
ENV VITE_DATABASE_URL=$VITE_DATABASE_URL
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_AWS_REGION=$VITE_AWS_REGION
ENV VITE_AWS_S3_BUCKET=$VITE_AWS_S3_BUCKET
ENV VITE_APP_NAME=$VITE_APP_NAME
ENV VITE_APP_URL=$VITE_APP_URL
ENV VITE_API_URL=$VITE_API_URL

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine AS production

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
