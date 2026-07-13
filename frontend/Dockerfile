# Multi-stage Dockerfile for Terraform Registry Frontend

# Stage 1: Build the React application
FROM node:24-alpine@sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd AS builder

# VITE_MODE controls the Vite build mode.
# Use "development" to enable the Dev Login button for E2E/staging environments.
# Defaults to "production" for normal production builds.
ARG VITE_MODE=production

WORKDIR /app

# Copy package files
COPY package.json package-lock.json .npmrc ./

# NODE_AUTH_TOKEN (a GitHub Packages read token) is injected as a BuildKit secret so npm
# can install the private @sethbacon/* dependency without baking the token into a layer.
# npm ci installs exactly what package-lock.json specifies (matches the CI pattern in
# .github/actions/setup-frontend, which already requires the lockfile to be in sync).
RUN --mount=type=secret,id=node_auth_token \
    NODE_AUTH_TOKEN="$(cat /run/secrets/node_auth_token)" npm ci --no-audit --no-fund

# Gate on production-dependency vulnerabilities only. Dev-only packages (e.g. eslint
# tooling) are excluded: they are not present in the final nginx image. Deliberately no
# `npm audit fix` here -- silently mutating the published image's dependency tree at
# build time would undermine the lockfile integrity npm ci above just established.
# A vulnerability fix belongs in a PR (Dependabot or manual `npm audit fix` + review)
# where the lockfile change is reviewed before it ships, not auto-applied in the image.
RUN --mount=type=secret,id=node_auth_token \
    export NODE_AUTH_TOKEN="$(cat /run/secrets/node_auth_token)" && \
    npm audit --audit-level=high --omit=dev

# Copy source code
COPY . .

# Build the application
RUN npx vite build --mode ${VITE_MODE}

# Stage 2: Serve with nginx
FROM nginx:1.31-alpine@sha256:54f2a904c251d5a34adf545a72d32515a15e08418dae0266e23be2e18c66fefa

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
