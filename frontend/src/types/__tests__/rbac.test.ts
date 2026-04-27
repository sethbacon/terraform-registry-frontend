import { describe, it, expect } from 'vitest'
import { AVAILABLE_SCOPES } from '../rbac'

describe('AVAILABLE_SCOPES', () => {
  it('contains 16 scopes', () => {
    expect(AVAILABLE_SCOPES).toHaveLength(16)
  })

  it('has required keys on every entry', () => {
    for (const scope of AVAILABLE_SCOPES) {
      expect(scope).toHaveProperty('value')
      expect(scope).toHaveProperty('label')
      expect(scope).toHaveProperty('description')
      expect(typeof scope.value).toBe('string')
      expect(typeof scope.label).toBe('string')
      expect(typeof scope.description).toBe('string')
    }
  })

  it('has no duplicate values', () => {
    const values = AVAILABLE_SCOPES.map((s) => s.value)
    expect(new Set(values).size).toBe(values.length)
  })

  it('includes the admin scope', () => {
    expect(AVAILABLE_SCOPES.some((s) => s.value === 'admin')).toBe(true)
  })

  it('includes read/write pairs for modules and providers', () => {
    const values = AVAILABLE_SCOPES.map((s) => s.value)
    expect(values).toContain('modules:read')
    expect(values).toContain('modules:write')
    expect(values).toContain('providers:read')
    expect(values).toContain('providers:write')
  })
})
