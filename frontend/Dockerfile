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

# Generate a self-signed TLS certificate so nginx can serve HTTPS on port 443
# right out of the box (no external volume required).  Real deployments should
# override these by mounting a certs volume at /etc/nginx/certs.
RUN apk add --no-cache openssl && \
    mkdir -p /etc/nginx/certs && \
    openssl req -x509 -newkey rsa:2048 \
      -keyout /etc/nginx/certs/server.key \
      -out /etc/nginx/certs/server.crt \
      -days 365 -nodes \
      -subj '/CN=localhost' && \
    chmod 600 /etc/nginx/certs/server.key

# Expose ports
EXPOSE 80 443

# Health check (HTTPS, ignoring self-signed cert)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider --no-check-certificate https://127.0.0.1:443/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
