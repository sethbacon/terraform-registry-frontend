#!/usr/bin/env bash
# generate-api-client.sh — Generate TypeScript types from the OpenAPI/Swagger contract snapshot.
#
# Usage:
#   ./scripts/generate-api-client.sh
#
# Reads:  frontend/openapi/swagger.json  (checked-in contract snapshot)
# Writes: frontend/src/services/generated/api.ts
#
# Run `npm run generate:api` from the frontend/ directory (calls this script).
# Run `npm run generate:swagger-snapshot` to first update the snapshot from a
# running backend, then regenerate.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SWAGGER_JSON="${FRONTEND_DIR}/openapi/swagger.json"
OUTPUT_FILE="${FRONTEND_DIR}/src/services/generated/api.ts"

if [[ ! -f "${SWAGGER_JSON}" ]]; then
  echo "ERROR: ${SWAGGER_JSON} not found. Run 'npm run generate:swagger-snapshot' first." >&2
  exit 1
fi

OPENAPI3_JSON="${FRONTEND_DIR}/openapi/openapi3.json"

echo "Converting Swagger 2.0 → OpenAPI 3.0..."
npx --yes swagger2openapi "${SWAGGER_JSON}" -o "${OPENAPI3_JSON}" -p

echo "Generating TypeScript types from ${OPENAPI3_JSON}..."
npx --yes openapi-typescript "${OPENAPI3_JSON}" --output "${OUTPUT_FILE}"

echo "Generated: ${OUTPUT_FILE}"
