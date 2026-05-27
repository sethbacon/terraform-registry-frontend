import { describe, it, expect } from 'vitest'
import { parsePlatformFilter, syncStatusColor } from '../terraform_mirror'
import type { TerraformBinaryDownloadResponse } from '../terraform_mirror'

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

describe('TerraformBinaryDownloadResponse', () => {
  it('includes shasums_url and shasums_signature_url fields', () => {
    const response: TerraformBinaryDownloadResponse = {
      os: 'linux',
      arch: 'amd64',
      version: '1.9.0',
      filename: 'terraform_1.9.0_linux_amd64.zip',
      sha256: 'abc123',
      download_url: 'https://example.com/download',
      shasums_url: 'https://example.com/SHA256SUMS',
      shasums_signature_url: 'https://example.com/SHA256SUMS.sig',
    }
    expect(response.shasums_url).toBe('https://example.com/SHA256SUMS')
    expect(response.shasums_signature_url).toBe('https://example.com/SHA256SUMS.sig')
  })

  it('allows empty string for shasums fields (pre-persistence versions)', () => {
    const response: TerraformBinaryDownloadResponse = {
      os: 'darwin',
      arch: 'arm64',
      version: '1.8.0',
      filename: 'terraform_1.8.0_darwin_arm64.zip',
      sha256: 'def456',
      download_url: 'https://example.com/download',
      shasums_url: '',
      shasums_signature_url: '',
    }
    expect(response.shasums_url).toBe('')
    expect(response.shasums_signature_url).toBe('')
  })
})
