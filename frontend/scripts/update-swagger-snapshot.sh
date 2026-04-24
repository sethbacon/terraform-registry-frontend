#!/usr/bin/env bash
# update-swagger-snapshot.sh — Fetch the live swagger.json from a running backend
# and update the checked-in snapshot used for contract testing.
#
# Usage:
#   BACKEND_URL=http://localhost:8080 ./scripts/update-swagger-snapshot.sh
#
# The BACKEND_URL defaults to http://localhost:8080.
# After updating the snapshot, re-run `npm run generate:api` to regenerate types.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SWAGGER_JSON="${FRONTEND_DIR}/openapi/swagger.json"

BACKEND_URL="${BACKEND_URL:-http://localhost:8080}"
SWAGGER_URL="${BACKEND_URL}/swagger.json"

echo "Fetching swagger.json from ${SWAGGER_URL}..."
curl --fail --silent --show-error --output "${SWAGGER_JSON}" "${SWAGGER_URL}"
echo "Snapshot updated: ${SWAGGER_JSON}"

echo ""
echo "Re-generating TypeScript types..."
bash "${SCRIPT_DIR}/generate-api-client.sh"
echo ""
echo "Done. Commit both openapi/swagger.json and src/services/generated/api.ts."
