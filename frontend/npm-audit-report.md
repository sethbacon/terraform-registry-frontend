# Frontend Security Audit Report — npm audit

**Audit date:** 2026-02-17
**Tool:** npm audit (npm v10+)
**Scope:** `frontend/` directory
**Packages audited:** 355

---

## Summary

| Severity | Before `npm audit fix` | After `npm audit fix` | Delta |
| --- | --- | --- | --- |
| Critical | 0 | 0 | — |
| High | 0 | 0 | — |
| Moderate | 9 | 9 | 0 (no fix available) |
| Low | 0 | 0 | — |

**`npm audit fix` result:** Updated 12 packages. The 9 moderate findings remain because
upstream ESLint and ajv have not yet published a compatible fix.

---

## Findings

### ajv < 8.18.0 — ReDoS via `$data` option (9 moderate)

**Advisory:** [GHSA-2g4f-4pwh-qvx6](https://github.com/advisories/GHSA-2g4f-4pwh-qvx6)

**Root cause:** `ajv` (a JSON Schema validator) < 8.18.0 is vulnerable to Regular Expression
Denial of Service (ReDoS) when using the `$data` option.

**Affected packages (dependency chain):**

```
ajv < 8.18.0
└── @eslint/eslintrc *
    └── eslint >= 4.2.0
        ├── @eslint-community/eslint-utils *
        │   └── @typescript-eslint/utils *
        │       ├── @typescript-eslint/eslint-plugin *
        │       └── @typescript-eslint/type-utils >= 5.9.2-alpha.0
        └── @typescript-eslint/parser *
            └── eslint-plugin-react-refresh *
```

**Scope:** All affected packages are **devDependencies** (ESLint and TypeScript ESLint tooling).
They are used exclusively during development linting and are **not included in the production
build output**. The Vite production build (`npm run build`) does not bundle any ESLint code.

**Fix availability:** `No fix available` — ESLint has not yet released a version that
resolves the transitive ajv dependency.

**Status: Accepted risk — dev-only tooling, not present in production bundle.**

---

## Remediation Status

| Finding | Severity | Fix available | Action taken | Resolution |
| --- | --- | --- | --- | --- |
| ajv ReDoS (9 instances) | Moderate | No | `npm audit fix` run — no change | Accepted risk: dev-only |

---

## Production Impact Assessment

The production Docker image (`frontend/Dockerfile`) is a multi-stage build:

1. **Build stage** (`node:20-alpine`): Runs `npm run build` (Vite bundler). Only production
   source code ends up in the output directory.
2. **Runtime stage** (`nginx:1.25-alpine`): Serves only the compiled static files from
   the build stage. Node.js and all `devDependencies` (including ESLint/ajv) are not present.

**The ajv vulnerability has zero impact on the production runtime environment.**

---

## Monitoring

Re-run audit periodically or after any `package.json` update:

```bash
cd frontend
npm audit
npm audit fix
```

When ESLint publishes a version with a compatible ajv >= 8.18.0 dependency, the 9 moderate
findings will be automatically resolved by running `npm audit fix`.
