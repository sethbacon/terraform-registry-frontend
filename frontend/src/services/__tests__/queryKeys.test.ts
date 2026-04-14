import { describe, it, expect } from 'vitest'
import { queryKeys } from '../queryKeys'

describe('queryKeys', () => {
  describe('modules', () => {
    it('has a stable _def key', () => {
      expect(queryKeys.modules._def).toEqual(['modules'])
    })

    it('produces unique search keys for different parameters', () => {
      const key1 = queryKeys.modules.search({ query: 'vpc', limit: 10, offset: 0, viewMode: 'grid' })
      const key2 = queryKeys.modules.search({ query: 'ecs', limit: 10, offset: 0, viewMode: 'grid' })
      const key3 = queryKeys.modules.search({ query: 'vpc', limit: 20, offset: 0, viewMode: 'grid' })

      expect(key1).not.toEqual(key2) // different query
      expect(key1).not.toEqual(key3) // different limit
    })

    it('produces identical keys for identical parameters', () => {
      const params = { query: 'vpc', limit: 10, offset: 0, viewMode: 'grid' }
      const key1 = queryKeys.modules.search(params)
      const key2 = queryKeys.modules.search({ ...params })

      expect(key1).toEqual(key2)
    })

    it('search key starts with the _def hierarchy', () => {
      const key = queryKeys.modules.search({ query: 'test', limit: 10, offset: 0, viewMode: 'grid' })
      expect(key[0]).toBe('modules')
      expect(key[1]).toBe('search')
    })
  })

  describe('providers', () => {
    it('has a stable _def key', () => {
      expect(queryKeys.providers._def).toEqual(['providers'])
    })

    it('produces unique search keys for different parameters', () => {
      const key1 = queryKeys.providers.search({ query: 'aws', limit: 10, offset: 0 })
      const key2 = queryKeys.providers.search({ query: 'gcp', limit: 10, offset: 0 })

      expect(key1).not.toEqual(key2)
    })

    it('search key includes hierarchy prefix', () => {
      const key = queryKeys.providers.search({ query: 'azure', limit: 10, offset: 0 })
      expect(key[0]).toBe('providers')
      expect(key[1]).toBe('search')
    })
  })

  describe('dashboard', () => {
    it('has a stable _def key', () => {
      expect(queryKeys.dashboard._def).toEqual(['dashboard'])
    })

    it('stats key is derived from _def', () => {
      const key = queryKeys.dashboard.stats()
      expect(key[0]).toBe('dashboard')
      expect(key[1]).toBe('stats')
    })

    it('stats key is stable across calls', () => {
      const key1 = queryKeys.dashboard.stats()
      const key2 = queryKeys.dashboard.stats()
      expect(key1).toEqual(key2)
    })
  })

  describe('key uniqueness across domains', () => {
    it('different domains produce non-overlapping key prefixes', () => {
      expect(queryKeys.modules._def).not.toEqual(queryKeys.providers._def)
      expect(queryKeys.modules._def).not.toEqual(queryKeys.dashboard._def)
      expect(queryKeys.providers._def).not.toEqual(queryKeys.dashboard._def)
    })
  })
})
