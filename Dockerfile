# syntax=docker/dockerfile:1
# check=skip=SecretsUsedInArgOrEnv
# VITE_SUPABASE_PUBLISHABLE_KEY is intentionally public browser configuration.
# Roost - Frontend Dockerfile
# Multi-stage build for optimized production image

# Stage 1: Build the application
FROM node:22-alpine AS builder

WORKDIR /app

# Build arguments for Vite environment variables
ARG VITE_DB_PROVIDER="supabase-cloud"
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_APP_NAME="Roost"
ARG VITE_APP_URL
ARG VITE_API_URL
ARG VITE_STRIPE_ENABLED="false"
ARG VITE_ENABLE_SIGNUP="true"
ARG VITE_ENABLE_SHOWCASE="true"
ARG VITE_ENABLE_LIVE_ROOM="true"
ARG VITE_ENABLE_ACTIVATIONS="false"
ARG VITE_ENABLE_LEADERBOARD="true"

# Set environment variables for build
ENV VITE_DB_PROVIDER=$VITE_DB_PROVIDER
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_APP_NAME=$VITE_APP_NAME
ENV VITE_APP_URL=$VITE_APP_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_STRIPE_ENABLED=$VITE_STRIPE_ENABLED
ENV VITE_ENABLE_SIGNUP=$VITE_ENABLE_SIGNUP
ENV VITE_ENABLE_SHOWCASE=$VITE_ENABLE_SHOWCASE
ENV VITE_ENABLE_LIVE_ROOM=$VITE_ENABLE_LIVE_ROOM
ENV VITE_ENABLE_ACTIVATIONS=$VITE_ENABLE_ACTIVATIONS
ENV VITE_ENABLE_LEADERBOARD=$VITE_ENABLE_LEADERBOARD

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Type-check and build the frontend. Repository-wide lint and tests run before
# image creation; test and backend sources are intentionally outside this image.
RUN npm run typecheck && npx vite build

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
