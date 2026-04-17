# Generates a local dev CA and Keycloak server certificate for HTTPS.
#
# Why this exists: backend >= 0.6.0 requires the OIDC issuer URL to use HTTPS.
# The docker-compose.oidc.yml overlay now runs Keycloak over HTTPS on port 8443
# with a locally-trusted cert produced by this script. The same CA cert is
# mounted into the backend container so it trusts the Keycloak TLS chain.
#
# Run this ONCE before bringing up the OIDC overlay. Outputs go to
# deployments/certs/ and are gitignored.
#
# Usage (from repo root or deployments/):
#   pwsh deployments/keycloak/generate-dev-certs.ps1
#
# Output files (in deployments/certs/):
#   dev-ca.crt        — root CA cert; mounted into backend, import into browser to remove warnings
#   dev-ca.key        — root CA private key (local only)
#   keycloak.crt      — Keycloak server cert signed by dev-ca, SANs: keycloak, localhost, 127.0.0.1
#   keycloak.key      — Keycloak server private key
#   ca-bundle.crt     — Alpine system CA bundle concatenated with dev-ca.crt
#                       (mounted into backend as /etc/ssl/certs/ca-certificates.crt)

$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$deploymentsDir = Split-Path -Parent $scriptDir
$certsDir = Join-Path $deploymentsDir 'certs'

New-Item -ItemType Directory -Force -Path $certsDir | Out-Null

Write-Host "Generating dev CA + Keycloak server cert in $certsDir" -ForegroundColor Cyan

# Run openssl inside an alpine container so no host openssl dependency is needed.
# Mount the certs dir as /out.
$opensslScript = @'
set -eu
cd /out

# 1. Dev root CA
openssl genrsa -out dev-ca.key 2048
openssl req -x509 -new -nodes -key dev-ca.key -sha256 -days 3650 \
  -subj "/CN=Terraform Registry Dev CA" \
  -out dev-ca.crt

# 2. Keycloak server key + CSR
openssl genrsa -out keycloak.key 2048
openssl req -new -key keycloak.key \
  -subj "/CN=keycloak" \
  -out keycloak.csr

# 3. SANs for keycloak cert
cat > keycloak.ext <<'EOF'
subjectAltName = DNS:keycloak,DNS:localhost,IP:127.0.0.1
extendedKeyUsage = serverAuth
EOF

# 4. Sign with dev CA
openssl x509 -req -in keycloak.csr \
  -CA dev-ca.crt -CAkey dev-ca.key -CAcreateserial \
  -out keycloak.crt -days 825 -sha256 \
  -extfile keycloak.ext

rm -f keycloak.csr keycloak.ext dev-ca.srl

# 5. Build a combined CA bundle: alpine system certs + our dev CA.
#    Backend mounts this over /etc/ssl/certs/ca-certificates.crt so Go's
#    system pool trusts both public CAs and our local dev CA.
cat /etc/ssl/certs/ca-certificates.crt dev-ca.crt > ca-bundle.crt

# Permissions: keys readable by container users (registry=1000, keycloak=1000).
chmod 644 *.key *.crt

echo "Generated:"
ls -la /out
'@

docker run --rm `
  -v "${certsDir}:/out" `
  alpine:3.21 `
  sh -c "apk add --no-cache openssl > /dev/null && $opensslScript"

if ($LASTEXITCODE -ne 0) {
  throw "openssl container exited with $LASTEXITCODE"
}

Write-Host ""
Write-Host "Done. Next steps:" -ForegroundColor Green
Write-Host "  1. (Optional, removes browser warnings) Import deployments/certs/dev-ca.crt"
Write-Host "     into Windows 'Trusted Root Certification Authorities'."
Write-Host "  2. Ensure C:\Windows\System32\drivers\etc\hosts contains:"
Write-Host "       127.0.0.1  registry.local keycloak"
Write-Host "  3. Bring up the OIDC stack:"
Write-Host "       cd deployments"
Write-Host "       docker compose -f docker-compose.yml -f docker-compose.oidc.yml up -d"
