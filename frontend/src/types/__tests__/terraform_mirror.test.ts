import { describe, it, expect } from 'vitest'
import { parsePlatformFilter, syncStatusColor } from '../terraform_mirror'

describe('parsePlatformFilter', () => {
  it('returns empty array for null', () => {
    expect(parsePlatformFilter(null)).toEqual([])
  })

  it('returns empty array for undefined', () => {
    expect(parsePlatformFilter(undefined)).toEqual([])
  })

  it('returns empty array for empty string', () => {
    expect(parsePlatformFilter('')).toEqual([])
  })

  it('parses a valid JSON array', () => {
    expect(parsePlatformFilter('["linux/amd64","darwin/arm64"]')).toEqual([
      'linux/amd64',
      'darwin/arm64',
    ])
  })

  it('returns empty array for invalid JSON', () => {
    expect(parsePlatformFilter('not-json')).toEqual([])
  })

  it('returns empty array for non-array JSON', () => {
    expect(parsePlatformFilter('{"os":"linux"}')).toEqual([])
  })
})

describe('syncStatusColor', () => {
  it.each([
    ['synced', 'success'],
    ['success', 'success'],
    ['syncing', 'info'],
    ['in_progress', 'info'],
    ['pending', 'warning'],
    ['failed', 'error'],
    ['partial', 'warning'],
  ] as const)('maps "%s" to "%s"', (status, expected) => {
    expect(syncStatusColor(status)).toBe(expected)
  })

  it('returns "default" for unknown status', () => {
    expect(syncStatusColor('unknown')).toBe('default')
    expect(syncStatusColor('')).toBe('default')
  })
})
