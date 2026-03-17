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

# Fix what can be auto-fixed, then gate on production-dependency vulnerabilities only.
# Dev-only packages (e.g. eslint → minimatch) are excluded: they are not present
# in the final nginx image and cannot be force-fixed without breaking build tooling.
# Gate at critical (not high) because swagger-ui-react pins immutable@3.x and
# dompurify@3.2.x — both have high-severity advisories that are unfixable until
# upstream migrates to immutable v4 / dompurify v3.3.2+.
RUN npm audit fix || true && \
    npm audit --audit-level=critical --omit=dev

# Copy source code
COPY . .

# Build the application
RUN npx vite build --mode ${VITE_MODE}

# Stage 2: Serve with nginx
FROM nginx:1.25-alpine

# Copy built files from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configs.
# nginx.conf is the default — used for local Docker Compose and E2E tests
# (HTTPS on port 443 with self-signed cert, backend:8080 hardcoded).
COPY nginx.conf /etc/nginx/conf.d/default.conf
# ECS template stored at a neutral path — NOT in /etc/nginx/templates/ which
# nginx's built-in entrypoint would auto-process unconditionally, overwriting
# default.conf even in local deployments. The custom entrypoint below activates
# it only when BACKEND_URL is set (i.e. ECS deployments).
COPY nginx-ecs.conf.template /etc/nginx/nginx-ecs.conf.template

# Custom entrypoint: selects nginx config based on BACKEND_URL env var.
# See docker-entrypoint.sh for details.
COPY docker-entrypoint.sh /docker-entrypoint-custom.sh
RUN chmod +x /docker-entrypoint-custom.sh

# Generate a self-signed TLS certificate for local Docker Compose use.
# In ECS the ALB handles TLS; the container only listens on port 80.
RUN apk add --no-cache openssl && \
    mkdir -p /etc/nginx/certs && \
    openssl req -x509 -newkey rsa:2048 \
    -keyout /etc/nginx/certs/server.key \
    -out /etc/nginx/certs/server.crt \
    -days 365 -nodes \
    -subj '/CN=localhost' \
    -addext 'subjectAltName=DNS:localhost,DNS:registry.local,IP:127.0.0.1' && \
    chmod 600 /etc/nginx/certs/server.key

# Pre-create nginx temp dirs owned by the nginx user (uid 101) so the
# container can run without the CHOWN capability (dropped by the Helm chart
# security context for AKS hardened namespaces).
RUN mkdir -p /var/cache/nginx/client_temp \
             /var/cache/nginx/proxy_temp \
             /var/cache/nginx/fastcgi_temp \
             /var/cache/nginx/uwsgi_temp \
             /var/cache/nginx/scgi_temp && \
    chown -R 101:101 /var/cache/nginx && \
    chown -R 101:101 /var/log/nginx && \
    sed -i 's|pid\s*/var/run/nginx.pid;|pid /tmp/nginx.pid;|' /etc/nginx/nginx.conf

# Expose ports
EXPOSE 80 443

# Health check on port 80 (works in ECS; local compose uses 443 via redirect)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider --no-check-certificate https://127.0.0.1:443/ || exit 1

CMD ["/docker-entrypoint-custom.sh"]
