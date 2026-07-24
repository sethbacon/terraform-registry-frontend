import { describe, it, expect } from 'vitest'
import { AxiosError, AxiosHeaders, CanceledError } from 'axios'
import {
  getErrorMessage,
  getErrorStatus,
  sanitizeServerErrorMessage,
  isCanceledError,
} from '../errors'

function axiosErrorWith(dataError: unknown, status = 500, message = 'Request failed'): AxiosError {
  const error = new AxiosError(message)
  error.response = {
    status,
    statusText: 'Error',
    data: { error: dataError },
    headers: {},
    config: { headers: new AxiosHeaders() },
  }
  return error
}

describe('getErrorMessage', () => {
  it('extracts error message from AxiosError with response.data.error', () => {
    const error = new AxiosError('Request failed')
    error.response = {
      status: 400,
      statusText: 'Bad Request',
      data: { error: 'Invalid namespace format' },
      headers: {},
      config: { headers: new AxiosHeaders() },
    }

    expect(getErrorMessage(error)).toBe('Invalid namespace format')
  })

  it('falls back to AxiosError.message when response.data.error is missing', () => {
    const error = new AxiosError('Network Error')
    error.response = {
      status: 500,
      statusText: 'Internal Server Error',
      data: {},
      headers: {},
      config: { headers: new AxiosHeaders() },
    }

    expect(getErrorMessage(error)).toBe('Network Error')
  })

  it('falls back to provided fallback when AxiosError has no useful message', () => {
    const error = new AxiosError('')
    error.response = {
      status: 500,
      statusText: 'Internal Server Error',
      data: {},
      headers: {},
      config: { headers: new AxiosHeaders() },
    }

    expect(getErrorMessage(error, 'Something went wrong')).toBe('Something went wrong')
  })

  it('returns a friendly localized message when the AxiosError has no response', () => {
    const error = new AxiosError('Network Error')
    expect(error.response).toBeUndefined()
    expect(getErrorMessage(error)).toBe(
      'Unable to reach the server — check your connection and try again.',
    )
  })

  it('prefers the friendly network message over a caller-provided fallback when there is no response', () => {
    const error = new AxiosError('Network Error')
    expect(getErrorMessage(error, 'Failed to delete provider. Please try again.')).toBe(
      'Unable to reach the server — check your connection and try again.',
    )
  })

  it('returns a distinct timeout message for ECONNABORTED, not the generic network message', () => {
    const error = new AxiosError('timeout of 30000ms exceeded', 'ECONNABORTED')
    expect(error.response).toBeUndefined()
    expect(getErrorMessage(error)).toBe(
      'The request took too long and timed out. Please try again.',
    )
  })

  // ─── Defense-in-depth: never surface leaked backend internals (#601, CWE-209) ──

  it('does not surface a leaked Go panic / stack trace verbatim', () => {
    const leaked = 'panic: runtime error: invalid memory address\n\tgoroutine 12 [running]'
    const error = axiosErrorWith(leaked, 500, 'Request failed with status code 500')
    const result = getErrorMessage(error)
    expect(result).not.toContain('panic')
    expect(result).not.toContain('goroutine')
    // Falls back to the safe axios boilerplate instead.
    expect(result).toBe('Request failed with status code 500')
  })

  it('does not surface a leaked SQL driver error verbatim', () => {
    const leaked = 'pq: duplicate key value violates unique constraint "users_email_key"'
    const error = axiosErrorWith(leaked, 409, 'Request failed with status code 409')
    const result = getErrorMessage(error)
    expect(result).not.toContain('constraint')
    expect(result).toBe('Request failed with status code 409')
  })

  it('does not surface a leaked filesystem path verbatim', () => {
    const leaked = 'open /var/lib/registry/blobs/tmp-9f3: no such file or directory'
    const error = axiosErrorWith(leaked, 500, 'Request failed with status code 500')
    expect(getErrorMessage(error)).not.toContain('/var/lib/registry')
  })

  it('does not surface a leaked internal host:port from a Go dial error verbatim', () => {
    const leaked = 'dial tcp 10.0.5.23:5432: connect: connection refused'
    const error = axiosErrorWith(leaked, 502, 'Request failed with status code 502')
    const result = getErrorMessage(error)
    expect(result).not.toContain('10.0.5.23')
    expect(result).not.toContain('dial tcp')
    // Falls back to the safe axios boilerplate instead of leaking the infra address.
    expect(result).toBe('Request failed with status code 502')
  })

  it('does not surface an over-long backend string verbatim', () => {
    const leaked = 'x'.repeat(500)
    const error = axiosErrorWith(leaked, 400, 'Request failed with status code 400')
    expect(getErrorMessage(error)).toBe('Request failed with status code 400')
  })

  it('still surfaces a short, clean backend message', () => {
    const error = axiosErrorWith('Invalid namespace format', 400)
    expect(getErrorMessage(error)).toBe('Invalid namespace format')
  })

  it('surfaces a short backend message that merely contains a non-internal dotted-numeric token (#601 no false positive)', () => {
    // A 4-part version string is not an internal-infra address; the IPv4 signature
    // must not suppress it and force a generic fallback.
    const error = axiosErrorWith('Provider version 1.2.3.4 is no longer supported', 400)
    expect(getErrorMessage(error)).toBe('Provider version 1.2.3.4 is no longer supported')
  })

  it('extracts message from native Error', () => {
    const error = new Error('File not found')
    expect(getErrorMessage(error)).toBe('File not found')
  })

  it('returns string error directly', () => {
    expect(getErrorMessage('Connection timeout')).toBe('Connection timeout')
  })

  it('returns default fallback for unrecognized error types', () => {
    expect(getErrorMessage(42)).toBe('An unexpected error occurred')
    expect(getErrorMessage(null)).toBe('An unexpected error occurred')
    expect(getErrorMessage(undefined)).toBe('An unexpected error occurred')
    expect(getErrorMessage({ code: 123 })).toBe('An unexpected error occurred')
  })

  it('returns custom fallback for unrecognized error types', () => {
    expect(getErrorMessage(42, 'Custom fallback')).toBe('Custom fallback')
  })
})

describe('getErrorStatus', () => {
  it('returns HTTP status from AxiosError', () => {
    const error = new AxiosError('Not Found')
    error.response = {
      status: 404,
      statusText: 'Not Found',
      data: {},
      headers: {},
      config: { headers: new AxiosHeaders() },
    }

    expect(getErrorStatus(error)).toBe(404)
  })

  it('returns undefined when AxiosError has no response', () => {
    const error = new AxiosError('Network Error')
    expect(getErrorStatus(error)).toBeUndefined()
  })

  it('returns undefined for native Error', () => {
    expect(getErrorStatus(new Error('oops'))).toBeUndefined()
  })

  it('returns undefined for non-error values', () => {
    expect(getErrorStatus('string')).toBeUndefined()
    expect(getErrorStatus(null)).toBeUndefined()
    expect(getErrorStatus(undefined)).toBeUndefined()
  })
})

describe('sanitizeServerErrorMessage', () => {
  it('returns short, clean messages unchanged (trimmed)', () => {
    expect(sanitizeServerErrorMessage('Invalid namespace format')).toBe('Invalid namespace format')
    expect(sanitizeServerErrorMessage('  Version already exists  ')).toBe('Version already exists')
  })

  it('rejects empty / whitespace-only messages', () => {
    expect(sanitizeServerErrorMessage('')).toBeNull()
    expect(sanitizeServerErrorMessage('   ')).toBeNull()
  })

  it('rejects over-long messages', () => {
    expect(sanitizeServerErrorMessage('x'.repeat(301))).toBeNull()
  })

  it('rejects multi-line messages (stack-trace shape)', () => {
    expect(sanitizeServerErrorMessage('boom\n\tat handler')).toBeNull()
  })

  it.each([
    ['panic', 'panic: nil pointer dereference'],
    ['goroutine', 'goroutine 42 [running]:'],
    ['go source ref', 'handlers/modules.go:88 upload failed'],
    ['memory address', 'segfault at 0x00c0000ba000'],
    ['sql driver', 'pq: relation "modules" does not exist'],
    ['sqlstate', 'ERROR: SQLSTATE 23505'],
    ['unix path', 'read /etc/registry/secret.key failed'],
    ['data mount path', 'open /data/storage/blobs/tmp-9f3: permission denied'],
    ['srv path', 'stat /srv/registry/uploads failed'],
    ['mnt path', 'cannot write /mnt/volume1/objects/x.tar: read-only file system'],
    ['storage base path', 'open /storage/local/modules/tmp: no such file or directory'],
    ['windows path', 'cannot open C:\\data\\blob.tmp'],
    ['go dial error', 'dial tcp 10.0.5.23:5432: connect: connection refused'],
    ['bare internal ip', 'upstream 192.168.1.10 did not respond'],
    ['loopback ip', 'proxy error contacting 127.0.0.1:9000'],
    ['private 172.16/12 ip', 'upstream 172.20.4.9 timed out'],
    ['link-local metadata ip', 'callback to 169.254.169.254 failed'],
    ['k8s service host', 'lookup registry-backend.default.svc.cluster.local failed'],
    ['internal hostname', 'timeout connecting to db.internal'],
  ])('rejects leaked internal detail (%s)', (_label, raw) => {
    expect(sanitizeServerErrorMessage(raw)).toBeNull()
  })

  it.each([
    ['four-part version', 'Provider version 1.2.3.4 is no longer supported'],
    ['public IP a user searched', 'No results found for 8.8.8.8'],
    ['public infra IP', 'Host 203.0.113.45 returned an unexpected status'],
    ['non-private 172 range', 'endpoint 172.5.3.4 rejected the request'],
  ])(
    'preserves a legitimate short message with a non-internal dotted-numeric token (%s) (#601 false-positive guard)',
    (_label, raw) => {
      expect(sanitizeServerErrorMessage(raw)).toBe(raw)
    },
  )
})

describe('isCanceledError', () => {
  it('is true for an axios CanceledError', () => {
    expect(isCanceledError(new CanceledError('canceled'))).toBe(true)
  })

  it('is false for a normal AxiosError, native Error, and other values', () => {
    expect(isCanceledError(new AxiosError('boom'))).toBe(false)
    expect(isCanceledError(new Error('boom'))).toBe(false)
    expect(isCanceledError('canceled')).toBe(false)
    expect(isCanceledError(null)).toBe(false)
  })
})
