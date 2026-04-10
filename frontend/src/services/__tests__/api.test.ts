import { describe, it, expect } from 'vitest'

describe('api service', () => {
  it('exports a default api client instance', async () => {
    const mod = await import('../api')
    expect(mod.default).toBeDefined()
  })

  it('api client is an object with expected public methods', async () => {
    const mod = await import('../api')
    const client = mod.default

    expect(client).toBeDefined()
    expect(typeof client.validateSetupToken).toBe('function')
    expect(typeof client.login).toBe('function')
    expect(typeof client.logout).toBe('function')
    expect(typeof client.getVersionInfo).toBe('function')
  })

  it('exposes setup-related methods that use SetupToken header', async () => {
    const mod = await import('../api')
    const client = mod.default

    expect(typeof client.validateSetupToken).toBe('function')
    expect(typeof client.testOIDCConfig).toBe('function')
    expect(typeof client.testStorageConfig).toBe('function')
    expect(typeof client.configureAdmin).toBe('function')
  })
})
