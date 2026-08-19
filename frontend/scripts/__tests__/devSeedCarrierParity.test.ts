import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

/**
 * Every SQL seed that provisions an administrator must also grant the
 * platform-admin carrier (#792 residue, found while fixing #796).
 *
 * WHY THIS EXISTS. Backend migration 000054 took the `admin` wildcard scope off
 * every role template: platform-admin authority now comes ONLY from a
 * `platform_admins` row. A seed that writes `organization_members` against the
 * `admin` role template and stops there produces a user who logs in, reaches
 * /admin, and then fails every platform-scoped read. #792 records that this
 * exact defect was written twice, fixed twice, and cost a release cycle --
 * because the first fix was genuinely verified against a real database, just
 * not against the file the stack actually loads.
 *
 * WHY IT ENUMERATES RATHER THAN LISTING. #792 proposes a guard over the two
 * seeds known at the time. A third copy -- deployments/keycloak/seed-oidc-dev.sql,
 * mounted by docker-compose.oidc.yml -- already existed with the same defect and
 * a two-file guard would have certified the repo clean while it sat there. So
 * this walks the tree for `*.sql` and derives its own subject set. A fourth copy
 * added tomorrow is in scope on the day it lands, with nobody having to
 * remember to add it here.
 *
 * WHAT IT CANNOT SEE. The third file in #792's table lives in
 * terraform-registry-backend (`backend/scripts/create-dev-admin-user.sql`).
 * Nothing in this repo can read it, so this guard covers the two copies that
 * are here and makes no claim about that one. #792 stays open for the
 * duplication itself; this only stops a resident copy from regressing.
 *
 * WHY node:fs RATHER THAN THE `?raw` IMPORT used by routeScopeParity.test.ts:
 * two reasons. `?raw` is a fixed path per import, which is exactly the listing
 * behaviour this guard exists to avoid; and `import.meta.glob` -- which does
 * enumerate -- is refused at load time by Vite's `server.fs.allow` boundary,
 * because these files sit outside `frontend/`. Reading them directly is the
 * option that neither hardcodes the subject list nor widens the dev server's
 * filesystem access for a test's benefit.
 */

// frontend/scripts/__tests__/ -> repo root. `import.meta.dirname` rather than
// `fileURLToPath(import.meta.url)`: under Vitest the latter is not yet a file:
// URL during module evaluation, which is when this walk has to run for
// `it.each` to have a subject list at collection time.
const REPO_ROOT = join(import.meta.dirname, '..', '..', '..')

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'coverage', 'playwright-report'])

function sqlFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue
      sqlFiles(join(dir, entry.name), found)
    } else if (entry.isFile() && entry.name.endsWith('.sql')) {
      found.push(join(dir, entry.name))
    }
  }
  return found
}

/** Strip `-- ...` line comments so a mention inside prose cannot satisfy a check. */
function stripComments(sql: string): string {
  return sql
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n')
}

interface Seed {
  path: string
  code: string
}

const allSql = sqlFiles(REPO_ROOT).map(
  (path): Seed => ({
    path: relative(REPO_ROOT, path).split(sep).join('/'),
    code: stripComments(readFileSync(path, 'utf8')),
  }),
)

/**
 * A seed "provisions an administrator" when it writes a membership row. Keyed
 * on the write, not on a filename convention or a header comment, because both
 * of those are things a new copy is free to spell differently.
 */
const adminSeeds = allSql.filter((s) => /INSERT\s+INTO\s+organization_members/i.test(s.code))

describe('dev-admin seed / platform-admin carrier parity (#792)', () => {
  it('finds SQL seeds at all', () => {
    // An empty universe passes every per-file assertion below vacuously. If the
    // walk stops finding files -- seeds moved, a directory added to SKIP_DIRS,
    // the path arithmetic above broken by a relocation -- this guard would go
    // green while checking nothing, which is the failure mode it is meant to
    // prevent in other people's code. So assert the subject set is non-empty
    // first, and that the classifier still matches something.
    expect(allSql.length).toBeGreaterThanOrEqual(2)
    expect(adminSeeds.length).toBeGreaterThanOrEqual(2)
  })

  it.each(adminSeeds.map((s) => [s.path, s] as const))(
    '%s grants the platform-admin carrier',
    (_path, seed) => {
      expect(seed.code).toMatch(/INSERT\s+INTO\s+platform_admins/i)
    },
  )

  it.each(adminSeeds.map((s) => [s.path, s] as const))(
    '%s writes the audit intent the carrier trigger requires',
    (_path, seed) => {
      // Migration 000052 puts a DEFERRABLE INITIALLY DEFERRED constraint
      // trigger on platform_admins that re-checks at COMMIT for an audit_outbox
      // row with the same pg_current_xact_id(), resource_type='platform_admin'
      // and action='platform_admin.granted'. A carrier INSERT without it does
      // not fail loudly at the INSERT -- it aborts the whole script at COMMIT,
      // so the seed appears to run and provisions nothing at all.
      expect(seed.code).toMatch(/INSERT\s+INTO\s+audit_outbox/i)
      expect(seed.code).toContain("'platform_admin.granted'")
      expect(seed.code).toContain("'platform_admin'")
    },
  )
})
