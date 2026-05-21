import { describe, it, expect } from 'vitest'
import { isValidRegistrySegment, REGISTRY_SEGMENT_RE } from '../registrySegment'

describe('isValidRegistrySegment', () => {
  it('accepts simple lowercase identifiers', () => {
    expect(isValidRegistrySegment('myorg')).toBe(true)
    expect(isValidRegistrySegment('my-org')).toBe(true)
    expect(isValidRegistrySegment('my_org')).toBe(true)
    expect(isValidRegistrySegment('a')).toBe(true)
    expect(isValidRegistrySegment('1org')).toBe(true)
    expect(isValidRegistrySegment('terraform-aws-123')).toBe(true)
  })

  it('accepts max-length (64-char) segments', () => {
    expect(isValidRegistrySegment('a'.repeat(64))).toBe(true)
  })

  it('rejects empty, spaces, and uppercase', () => {
    expect(isValidRegistrySegment('')).toBe(false)
    expect(isValidRegistrySegment('My Org')).toBe(false)
    expect(isValidRegistrySegment('MyOrg')).toBe(false)
  })

  it('rejects leading hyphen/underscore', () => {
    expect(isValidRegistrySegment('-myorg')).toBe(false)
    expect(isValidRegistrySegment('_myorg')).toBe(false)
  })

  it('rejects special characters and dots/slashes', () => {
    expect(isValidRegistrySegment('my.org')).toBe(false)
    expect(isValidRegistrySegment('my/org')).toBe(false)
    expect(isValidRegistrySegment('my@org')).toBe(false)
  })

  it('rejects over-length (65-char) segments', () => {
    expect(isValidRegistrySegment('a'.repeat(65))).toBe(false)
  })

  it('regex is sealed (anchored at both ends)', () => {
    expect(REGISTRY_SEGMENT_RE.test('myorg\nbad')).toBe(false)
    expect(REGISTRY_SEGMENT_RE.test(' myorg ')).toBe(false)
  })
})
