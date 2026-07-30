import { describe, it, expect } from 'vitest'
import pkg from '../../package.json'

/**
 * `@sentry/react` is dynamically imported by shipped runtime code
 * (services/errorReporting.ts's init()/captureError()/setUser()) whenever
 * VITE_SENTRY_DSN is configured, so it must be a real `dependencies` entry.
 * Leaving it under `devDependencies` works today only because the Docker
 * build's `npm ci` installs devDependencies too -- a future `--omit=dev`
 * install would silently drop the package and disable Sentry reporting
 * with no build error (#610).
 */
describe('package.json dependency placement', () => {
  it('lists @sentry/react as a production dependency, not a devDependency', () => {
    expect(pkg.dependencies).toHaveProperty('@sentry/react')
    expect(pkg.devDependencies).not.toHaveProperty('@sentry/react')
  })
})
