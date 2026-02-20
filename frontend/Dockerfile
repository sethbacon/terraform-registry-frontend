# Multi-stage Dockerfile for Terraform Registry Frontend

# Stage 1: Build the React application
FROM node:20-alpine AS builder

# VITE_MODE controls the Vite build mode.
# Use "development" to enable the Dev Login button for E2E/staging environments.
# Defaults to "production" for normal production builds.
ARG VITE_MODE=production

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies (use npm install so lockfile mismatches don't fail in CI for dev)
RUN npm install --no-audit --no-fund

# Fix security vulnerabilities
RUN npm audit fix || true

# Copy source code
COPY . .

# Build the application
RUN npx vite build --mode ${VITE_MODE}

# Stage 2: Serve with nginx
FROM nginx:1.25-alpine

# Copy built files from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
