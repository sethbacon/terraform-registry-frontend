#!/bin/sh
# Custom nginx entrypoint — selects the correct nginx config based on deployment mode.
#
# BACKEND_URL is set   → ECS mode: render nginx-ecs.conf.template and serve on port 80
#                        (TLS is terminated at the ALB; the container speaks plain HTTP)
# BACKEND_URL is unset → Local Docker Compose / E2E mode: use nginx.conf as-is
#                        (HTTPS on port 443 with self-signed cert, backend:8080 hardcoded)
set -e

if [ -n "$BACKEND_URL" ]; then
    envsubst '${BACKEND_URL}' \
        < /etc/nginx/nginx-ecs.conf.template \
        > /etc/nginx/conf.d/default.conf
else
    # Local Docker Compose / E2E: nginx.conf serves HTTPS on 443 with a
    # throwaway self-signed localhost cert. Generate it here at startup rather
    # than at image-build time, so the private key is never baked into -- or
    # published with -- the image (Trivy's secret scanner flags a baked-in key).
    # Production sets BACKEND_URL, terminates TLS at the ALB/ingress, and never
    # reaches this branch.
    if [ ! -f /etc/nginx/certs/server.key ]; then
        openssl req -x509 -newkey rsa:2048 \
            -keyout /etc/nginx/certs/server.key \
            -out /etc/nginx/certs/server.crt \
            -days 365 -nodes \
            -subj '/CN=localhost' \
            -addext 'subjectAltName=DNS:localhost,DNS:registry.local,IP:127.0.0.1'
        chmod 600 /etc/nginx/certs/server.key
    fi
fi

exec nginx -g 'daemon off;'
