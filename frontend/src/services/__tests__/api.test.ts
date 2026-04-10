import { describe, it, expect } from 'vitest'

describe('api service', () => {
  it('exports both default and named apiClient pointing to same instance', async () => {
    const mod = await import('../api')
    expect(mod.default).toBe(mod.apiClient)
  })

  it('apiClient is an object with expected public methods', async () => {
    const mod = await import('../api')
    const client = mod.apiClient

    expect(client).toBeDefined()
    expect(typeof client.validateSetupToken).toBe('function')
    expect(typeof client.login).toBe('function')
    expect(typeof client.logout).toBe('function')
    expect(typeof client.getVersionInfo).toBe('function')
  })

  it('exposes setup-related methods that use SetupToken header', async () => {
    const mod = await import('../api')
    const client = mod.apiClient

    expect(typeof client.validateSetupToken).toBe('function')
    expect(typeof client.testOIDCConfig).toBe('function')
    expect(typeof client.testStorageConfig).toBe('function')
    expect(typeof client.configureAdmin).toBe('function')
  })
})
