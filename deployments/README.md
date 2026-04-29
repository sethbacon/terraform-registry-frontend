# Terraform Registry – Local Deployments

## Standard Dev Stack (no OIDC)

Starts postgres, backend (DEV_MODE), and the frontend nginx with a self-signed cert.
The **Dev Login** button is available in DEV_MODE — no identity provider needed.
Setup is not required; the banner does not appear in DEV_MODE.

```bash
cd deployments
docker compose up -d
```

App: **<https://registry.local:3000>**

Add to your hosts file if not already present:

```txt
127.0.0.1  registry.local keycloak
```

---

## OIDC Test Stack (Keycloak)

Adds a **Keycloak** identity provider, pre-configured with a test realm and 7 users.
DEV_MODE is disabled so the full OIDC login flow is exercised.

A `db-seed` service runs once after the backend is healthy and:

- Marks setup as complete (no setup wizard needed — OIDC is pre-configured via env vars)
- Pre-provisions `admin@example.com` (Keycloak's `admin.user`) as a registry admin

```bash
cd deployments
docker compose -f docker-compose.yml -f docker-compose.oidc.yml up -d
```

### Keycloak startup

Keycloak takes ~30–60 seconds to start and import the realm. Watch progress:

```bash
docker compose -f docker-compose.yml -f docker-compose.oidc.yml logs -f keycloak
```

The backend waits for Keycloak's health check to pass before starting.
The `db-seed` service runs after the backend is healthy, then exits.

### Access points

| Service             | URL                                                                               |
| ------------------- | --------------------------------------------------------------------------------- |
| Registry (frontend) | <https://registry.local:3000> (accept self-signed cert warning once)              |
| Keycloak admin      | <http://keycloak:8180/admin> (admin / admin)                                      |
| OIDC discovery      | <http://keycloak:8180/realms/terraform-registry/.well-known/openid-configuration> |

### Test users

All users share the password **`TestPass123!`**

`admin.user` is pre-provisioned as a registry admin. The other users authenticate successfully
but have no registry role assigned until an admin grants them one.

| Username      | Email               | Name          | Registry role    |
| ------------- | ------------------- | ------------- | ---------------- |
| admin.user    | <admin@example.com> | Admin User    | admin            |
| alice.dev     | <alice@example.com> | Alice Dev     | none (see below) |
| bob.ops       | <bob@example.com>   | Bob Ops       | none             |
| carol.qa      | <carol@example.com> | Carol QA      | none             |
| dave.readonly | <dave@example.com>  | Dave Readonly | none             |
| eve.viewer    | <eve@example.com>   | Eve Viewer    | none             |
| frank.test    | <frank@example.com> | Frank Test    | none             |

To assign a role to a non-admin user: log in as `admin.user`, go to **Admin → Users**,
find the user, and assign a role template.

### OIDC login flow

1. Navigate to **<https://registry.local:3000>** (accept the self-signed cert warning once)
2. Click **Login** — you will be redirected to the Keycloak login page at `keycloak:8180`
3. Enter any test user's credentials
4. Keycloak redirects back to the registry; you are logged in

### Re-seeding after a volume wipe

The `db-seed` service is idempotent — it runs on every `docker compose up` and uses
`ON CONFLICT DO NOTHING/UPDATE`, so it is safe to run against an existing database.
If you wipe the postgres volume, simply restart the stack:

```bash
docker compose -f docker-compose.yml -f docker-compose.oidc.yml down -v
docker compose -f docker-compose.yml -f docker-compose.oidc.yml up -d
```

### Stopping the stack

```bash
docker compose -f docker-compose.yml -f docker-compose.oidc.yml down
```

To also remove volumes (wipes postgres data):

```bash
docker compose -f docker-compose.yml -f docker-compose.oidc.yml down -v
```

---

## Dev workflow: setup wizard

| Stack                                  | Setup wizard shown | How                                          |
| -------------------------------------- | ------------------ | -------------------------------------------- |
| Standard dev (`docker-compose.yml`)    | No                 | DEV_MODE=true skips setup check              |
| OIDC test (`docker-compose.oidc.yml`)  | No                 | `db-seed` marks setup complete automatically |
| Production (`docker-compose.prod.yml`) | On first boot      | Run wizard once; completion persisted in DB  |

---

## Configuration files

| File                         | Purpose                                                             |
| ---------------------------- | ------------------------------------------------------------------- |
| `docker-compose.yml`         | Base stack: postgres, backend, frontend                             |
| `docker-compose.oidc.yml`    | OIDC overlay: adds Keycloak, db-seed, reconfigures backend for OIDC |
| `docker-compose.prod.yml`    | Production overrides (pre-built images, no DEV_MODE)                |
| `docker-compose.test.yml`    | E2E test stack (Playwright)                                         |
| `keycloak/realm-export.json` | Keycloak realm definition: client, users, mappers                   |
| `keycloak/seed-oidc-dev.sql` | SQL seed: marks setup complete, provisions admin@example.com        |
| `create-dev-admin-user.sql`  | SQL to seed a dev admin user for the standard dev stack             |

---

## E2E / CI Test Stack

`docker-compose.test.yml` pulls the published backend image from GHCR and builds
the frontend with HTTPS for Playwright. The base compose file is included via
the `extends` directive — no `-f` chaining required:

```bash
cd deployments
docker compose -f docker-compose.test.yml up -d --build
# Frontend (HTTPS): https://localhost:3000
# Backend API:      http://localhost:8080
```

To exercise an unpublished backend change (e.g. a new migration), build the
backend locally and override `BACKEND_IMAGE`:

```bash
cd ../../terraform-registry-backend/deployments
docker compose build backend
cd ../../terraform-registry-frontend/deployments
BACKEND_IMAGE=deployments-backend docker compose -f docker-compose.test.yml up -d --build
```
