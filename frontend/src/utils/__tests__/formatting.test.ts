import { describe, it, expect } from 'vitest'
import { formatDate } from '../formatting'

describe('formatDate', () => {
  it('formats a valid ISO date string', () => {
    const result = formatDate('2024-01-15T10:30:00Z')
    // The exact format depends on locale, but it should contain the date components
    expect(result).toBeTruthy()
    expect(result).not.toBe('N/A')
    // Should contain the year
    expect(result).toContain('2024')
  })

  it('returns "N/A" for null', () => {
    expect(formatDate(null)).toBe('N/A')
  })

  it('returns "N/A" for undefined', () => {
    expect(formatDate(undefined)).toBe('N/A')
  })

  it('returns "N/A" for empty string', () => {
    expect(formatDate('')).toBe('N/A')
  })

  it('returns custom fallback for nullish values', () => {
    expect(formatDate(null, 'Unknown')).toBe('Unknown')
    expect(formatDate(undefined, 'Not set')).toBe('Not set')
    expect(formatDate('', 'No date')).toBe('No date')
  })

  it('handles different ISO 8601 formats', () => {
    // Full ISO with timezone
    expect(formatDate('2023-12-25T00:00:00.000Z')).toContain('2023')

    // Date only string
    const result = formatDate('2023-06-15')
    expect(result).toBeTruthy()
    expect(result).not.toBe('N/A')
  })
})
