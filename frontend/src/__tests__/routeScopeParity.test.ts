import { describe, it, expect } from 'vitest'
// Vite's `?raw` import rather than node:fs. It needs no @types/node and no
// path arithmetic relative to the test file's runtime location, and it is
// resolved by the same bundler that builds the app, so the file this reads is
// unambiguously the file that ships. vite-env.d.ts already references
// vite/client, which declares the `*?raw` module shape.
import appSource from '../App.tsx?raw'
import { ADMIN_ROUTE_SCOPES } from '../routeScopes'

/**
 * Parity guard between App.tsx's route wiring and routeScopes.ts (#693).
 *
 * The typing added for #686 makes a MISSING map key a compile error, which is
 * the strong half of that fix. This is the half the compiler cannot do: it
 * reads App.tsx as text and checks the two files still describe the same set of
 * routes, in both directions.
 *
 * Bidirectional on purpose. A one-way check ("every route has a key") passes
 * forever while the map accumulates entries for routes that no longer exist,
 * and a stale entry is how the sidebar keeps advertising a page that 404s. The
 * same reasoning as any allowlist guard: an entry that no longer corresponds to
 * anything is a finding, not a leftover.
 */

/** Every `<Route path="/admin...">` block, with its element markup. */
function adminRouteBlocks(): { path: string; element: string }[] {
  const blocks: { path: string; element: string }[] = []
  const routeRe = /<Route\s+path="(\/admin[^"]*)"\s+element=\{([\s\S]*?)\}\s*\/>/g
  let m: RegExpExecArray | null
  while ((m = routeRe.exec(appSource)) !== null) {
    blocks.push({ path: m[1], element: m[2] })
  }
  return blocks
}

describe('admin route scope parity (#693)', () => {
  const blocks = adminRouteBlocks()

  it('finds the admin routes at all', () => {
    // If the regex stops matching (App.tsx reformatted, Route spelled
    // differently), every assertion below would vacuously pass over an empty
    // list. An empty universe is the failure mode this whole guard exists to
    // prevent, so it is asserted first.
    expect(blocks.length).toBeGreaterThanOrEqual(Object.keys(ADMIN_ROUTE_SCOPES).length)
  })

  it('every gated admin route reads its scope from ADMIN_ROUTE_SCOPES', () => {
    const gated = blocks.filter((b) => b.element.includes('<LazyRoute'))
    const missing = gated.filter((b) => !(b.path in ADMIN_ROUTE_SCOPES)).map((b) => b.path)
    expect(missing, 'admin routes with no entry in ADMIN_ROUTE_SCOPES').toEqual([])
  })

  it('no admin route is marked public', () => {
    // `isPublic` on an /admin route compiles cleanly — it is a legitimate shape
    // for the public pages — but on an admin path it is the #686 fail-open
    // reintroduced deliberately rather than by accident.
    const publicAdmin = blocks.filter((b) => b.element.includes('isPublic')).map((b) => b.path)
    expect(publicAdmin, 'admin routes wired with isPublic').toEqual([])
  })

  it('every ADMIN_ROUTE_SCOPES entry corresponds to a real route', () => {
    const routed = new Set(blocks.map((b) => b.path))
    const orphaned = Object.keys(ADMIN_ROUTE_SCOPES).filter((p) => !routed.has(p))
    expect(orphaned, 'ADMIN_ROUTE_SCOPES keys with no route in App.tsx').toEqual([])
  })

  it('redirect-only admin routes are allowed to have no scope entry', () => {
    // /admin/upload is a <Navigate> to /admin/upload/module. It renders no page,
    // so it has nothing to gate; the target route carries the scope. This is
    // asserted rather than merely tolerated, so that turning a redirect into a
    // real page without adding a scope entry fails the test above instead of
    // quietly matching this exemption.
    const redirects = blocks.filter((b) => b.element.includes('<Navigate'))
    for (const r of redirects) {
      expect(
        r.element.includes('<LazyRoute'),
        `${r.path} is exempt as a redirect but also renders a LazyRoute`,
      ).toBe(false)
    }
  })
})
