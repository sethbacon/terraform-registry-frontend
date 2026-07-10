import { describe, it, expect, beforeEach } from 'vitest'
import { AUTH_STORAGE_KEYS, clearAuthStorage } from '../authStorage'

describe('AUTH_STORAGE_KEYS', () => {
  it('names every known auth-related localStorage key', () => {
    // Locks in the authoritative set so an accidental deletion from the array
    // (as opposed to an addition, which the tests below already catch by
    // iterating the array) is also caught.
    expect(AUTH_STORAGE_KEYS).toEqual([
      'auth_token',
      'user',
      'role_template',
      'allowed_scopes',
      'authorized',
    ])
  })
})

describe('clearAuthStorage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('removes every key in AUTH_STORAGE_KEYS', () => {
    AUTH_STORAGE_KEYS.forEach((key) => localStorage.setItem(key, 'seed-value'))

    clearAuthStorage()

    // Iterating the exported array (rather than a hardcoded literal list) means
    // this test automatically covers any key added to AUTH_STORAGE_KEYS in the
    // future, so it can't silently pass while a real key goes unverified --
    // the original gap here was that only 2 of the 5 keys were ever asserted on.
    AUTH_STORAGE_KEYS.forEach((key) => {
      expect(localStorage.getItem(key)).toBeNull()
    })
  })

  it.each(AUTH_STORAGE_KEYS)('removes "%s" specifically', (key) => {
    localStorage.setItem(key, 'seed-value')
    clearAuthStorage()
    expect(localStorage.getItem(key)).toBeNull()
  })

  it('is safe to call when no auth keys are present', () => {
    expect(() => clearAuthStorage()).not.toThrow()
    AUTH_STORAGE_KEYS.forEach((key) => {
      expect(localStorage.getItem(key)).toBeNull()
    })
  })

  it('does not remove unrelated localStorage keys', () => {
    localStorage.setItem('unrelated_app_setting', 'keep-me')
    AUTH_STORAGE_KEYS.forEach((key) => localStorage.setItem(key, 'seed-value'))

    clearAuthStorage()

    expect(localStorage.getItem('unrelated_app_setting')).toBe('keep-me')
  })
})
