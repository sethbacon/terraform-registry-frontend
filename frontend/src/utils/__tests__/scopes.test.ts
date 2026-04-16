import { describe, it, expect } from 'vitest'
import { getScopeInfo, getScopeColor } from '../scopes'

describe('getScopeInfo', () => {
  it('returns scope metadata for a known scope', () => {
    const info = getScopeInfo('modules:read')
    expect(info.value).toBe('modules:read')
    expect(info.label).toBe('Modules Read')
    expect(info.description).toBe('View modules and versions')
  })

  it('returns admin scope info', () => {
    const info = getScopeInfo('admin')
    expect(info.value).toBe('admin')
    expect(info.label).toBe('Administrator')
  })

  it('returns fallback for unknown scope', () => {
    const info = getScopeInfo('custom:unknown')
    expect(info.value).toBe('custom:unknown')
    expect(info.label).toBe('custom:unknown')
    expect(info.description).toBe('Unknown scope')
  })

  it('returns correct info for mirrors:manage', () => {
    const info = getScopeInfo('mirrors:manage')
    expect(info.label).toBe('Mirrors Manage')
  })
})

describe('getScopeColor', () => {
  it('returns error for admin scope', () => {
    expect(getScopeColor('admin')).toBe('error')
  })

  it('returns warning for :write scopes', () => {
    expect(getScopeColor('modules:write')).toBe('warning')
    expect(getScopeColor('users:write')).toBe('warning')
  })

  it('returns warning for :manage scopes', () => {
    expect(getScopeColor('mirrors:manage')).toBe('warning')
    expect(getScopeColor('scm:manage')).toBe('warning')
  })

  it('returns success for :read scopes', () => {
    expect(getScopeColor('modules:read')).toBe('success')
    expect(getScopeColor('audit:read')).toBe('success')
  })

  it('returns default for unrecognized patterns', () => {
    expect(getScopeColor('something')).toBe('default')
    expect(getScopeColor('')).toBe('default')
  })
})
