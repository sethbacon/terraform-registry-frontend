import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * The contract check runs against a PINNED backend image, and nothing forces
 * that pin to stay current.
 *
 * A stale pin fails nothing on its own. It quietly weakens the check: every
 * backend route added since the pin has to be allowlisted for a PR to go green,
 * and each allowlist entry is a route nothing verifies. The pin sat at 3.5.2
 * while the backend reached 4.20.0 -- one major and fifteen minors -- and three
 * platform-admin entries were dead weight for that entire time, because the
 * stale-entry check can only fire once someone bumps the pin.
 *
 * So this measures the HARM rather than the version gap: how many routes the
 * check is currently not verifying. A couple is normal (a route genuinely in
 * flight across repos). A growing pile means the pin needs bumping, and that is
 * the actionable instruction.
 *
 * Deliberately local and network-free. Comparing the pin against the newest
 * published backend tag would be a truer measure of drift, but it would put a
 * registry call in the unit-test path and fail on an unrelated outage.
 */

// Matches the sibling repo-hygiene tests (e2eWaitBudget.test.ts).
const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..', '..')

// Permanent entries are exempt: the four DEV_MODE routes are undocumented in
// production swagger BY DESIGN and no pin bump will ever cover them.
const isPermanent = (reason: string) => /permanent allowlist entry/i.test(reason)

// Headroom for routes legitimately in flight across the two repos, above which
// the pin is the thing to fix.
const MAX_UNVERIFIED_ROUTES = 3

interface AllowlistEntry {
  method: string
  path: string
  reason: string
}

function readAllowlist(): AllowlistEntry[] {
  const raw = readFileSync(
    resolve(REPO, 'frontend', 'scripts', 'contract-check.allowlist.json'),
    'utf8',
  )
  return (JSON.parse(raw) as { entries: AllowlistEntry[] }).entries
}

describe('contract-check pin currency', () => {
  it('does not accumulate unverified routes behind a stale backend pin', () => {
    const temporary = readAllowlist().filter((e) => !isPermanent(e.reason))
    const listed = temporary.map((e) => `${e.method} ${e.path}`).join('\n  ')

    expect(
      temporary.length,
      `${temporary.length} route(s) are allowlisted out of the contract check:\n  ${listed}\n\n` +
        `Each is a route the check does NOT verify. Past ${MAX_UNVERIFIED_ROUTES} this usually ` +
        `means the pinned backend in deployments/docker-compose.contract-check.yml is behind. ` +
        `Bump BACKEND_IMAGE to a release containing these routes, then delete the entries the ` +
        `stale-entry check reports.`,
    ).toBeLessThanOrEqual(MAX_UNVERIFIED_ROUTES)
  })

  it('every allowlist entry explains itself and is either permanent or removable', () => {
    for (const e of readAllowlist()) {
      // The allowlist's own rule: the reason must link a tracked issue or
      // document the rationale, so an entry cannot outlive its justification
      // silently.
      expect(e.reason, `${e.method} ${e.path} has no reason`).toBeTruthy()
      expect(
        isPermanent(e.reason) || /remove this entry once|tracked in #\d+|#\d+/i.test(e.reason),
        `${e.method} ${e.path} is neither marked permanent nor says what would remove it:\n  ${e.reason}`,
      ).toBe(true)
    }
  })

  it('pins a concrete backend image rather than a floating tag', () => {
    // :latest would make the check silently non-reproducible -- a green PR and
    // a red main from the same commit.
    const compose = readFileSync(
      resolve(REPO, 'deployments', 'docker-compose.contract-check.yml'),
      'utf8',
    )
    const pin = compose.match(
      /BACKEND_IMAGE:-ghcr\.io\/sethbacon\/terraform-registry-backend:([^\s}]+)/,
    )
    expect(pin, 'no BACKEND_IMAGE pin found in docker-compose.contract-check.yml').not.toBeNull()
    expect(pin![1]).toMatch(/^\d+\.\d+\.\d+$/)
  })
})
