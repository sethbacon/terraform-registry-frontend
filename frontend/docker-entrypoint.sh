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
fi

exec nginx -g 'daemon off;'
