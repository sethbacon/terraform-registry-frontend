/**
 * Version ordering for registry version lists (#673).
 *
 * `useModuleDetail` and `useProviderDetail` each carried their own copy of a
 * `sortVersionsDesc` helper. The copies were forked from one source and then
 * only the provider one was fixed to put stable releases ahead of pre-releases,
 * so the same version list sorted differently depending on which page you were
 * looking at. This module is the single implementation both hooks now call;
 * `semver.test.ts` also guards the hooks against growing a private copy again.
 *
 * The ordering follows semver.org §11 precedence, descending (newest first):
 *   1. major, then minor, then patch, compared numerically
 *   2. at equal numeric version, a stable release outranks any pre-release
 *   3. between two pre-releases, dot-separated identifiers are compared
 *      left to right — numeric identifiers numerically, alphanumeric ones
 *      by ASCII order, numeric always below alphanumeric, and a shorter set
 *      of identifiers below a longer one that shares its prefix.
 *
 * Build metadata (`+sha`) is stripped before comparison, as semver requires.
 *
 * Unparseable input is *ordered*, not ignored. Returning NaN from a comparator
 * is undefined behaviour (the spec coerces it to 0), which makes the resulting
 * order non-transitive and engine-dependent — the previous copies did exactly
 * that for any non-numeric component. Here a present-but-unparseable component
 * is treated as lower than any real version, so junk sinks to the bottom of the
 * list deterministically instead of scrambling the entries around it.
 */

/**
 * Sentinel for a version component that is present but not a number. Below any
 * real component (which is a non-negative integer), so such versions sort last.
 */
const UNPARSEABLE = -1

interface ParsedVersion {
  major: number
  minor: number
  patch: number
  /** Pre-release identifiers as written, without the leading '-'. '' = stable. */
  prerelease: string
}

/** A missing component is 0 (`1.2` means `1.2.0`); a malformed one is UNPARSEABLE. */
function numericComponent(part: string | undefined): number {
  if (part === undefined) return 0
  return /^\d+$/.test(part) ? Number(part) : UNPARSEABLE
}

function parseVersion(raw: string): ParsedVersion {
  // Order matters: build metadata may follow a pre-release ('1.0.0-rc.1+abc'),
  // so it is stripped first; the pre-release is then everything after the FIRST
  // '-' (identifiers may themselves contain '-', e.g. '1.0.0-alpha-1').
  const withoutBuild = String(raw ?? '')
    .trim()
    .replace(/^v/i, '')
    .split('+')[0]
  const dash = withoutBuild.indexOf('-')
  const core = dash === -1 ? withoutBuild : withoutBuild.slice(0, dash)
  const prerelease = dash === -1 ? '' : withoutBuild.slice(dash + 1)
  const parts = core.split('.')
  return {
    major: numericComponent(parts[0]),
    minor: numericComponent(parts[1]),
    patch: numericComponent(parts[2]),
    prerelease,
  }
}

/** semver.org §11.4 precedence, ascending. '' (a stable release) ranks highest. */
function comparePrerelease(a: string, b: string): number {
  if (a === b) return 0
  if (a === '') return 1
  if (b === '') return -1
  const aIds = a.split('.')
  const bIds = b.split('.')
  const len = Math.max(aIds.length, bIds.length)
  for (let i = 0; i < len; i++) {
    const x = aIds[i]
    const y = bIds[i]
    // A smaller set of identifiers ranks lower when all preceding ones match.
    if (x === undefined) return -1
    if (y === undefined) return 1
    const xNumeric = /^\d+$/.test(x)
    const yNumeric = /^\d+$/.test(y)
    if (xNumeric && yNumeric) {
      if (Number(x) !== Number(y)) return Number(x) - Number(y)
    } else if (xNumeric !== yNumeric) {
      return xNumeric ? -1 : 1
    } else if (x !== y) {
      return x < y ? -1 : 1
    }
  }
  return 0
}

/**
 * Compare two version strings newest-first. Suitable as an Array#sort
 * comparator; never returns NaN, so the resulting order is a total order.
 */
export function compareVersionsDesc(a: string, b: string): number {
  const left = parseVersion(a)
  const right = parseVersion(b)
  if (left.major !== right.major) return right.major - left.major
  if (left.minor !== right.minor) return right.minor - left.minor
  if (left.patch !== right.patch) return right.patch - left.patch
  // Arguments swapped: comparePrerelease is ascending, this comparator is not.
  return comparePrerelease(right.prerelease, left.prerelease)
}

/**
 * Sort any list of version-bearing records newest-first, without mutating the
 * input. Generic over the record type so module and provider version lists keep
 * their own element types — the helper only ever reads `version`.
 */
export function sortByVersionDesc<T extends { version: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => compareVersionsDesc(a.version, b.version))
}
