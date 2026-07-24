import { describe, it, expect } from 'vitest'
import { AxiosError, AxiosHeaders } from 'axios'
import { retryQuery, queryClient } from '../queryClient'

function axiosErrorWithStatus(status: number): AxiosError {
  const error = new AxiosError('Request failed')
  error.response = {
    status,
    statusText: 'Error',
    data: {},
    headers: {},
    config: { headers: new AxiosHeaders() },
  }
  return error
}

// ─── Status-aware query retry (#616) ────────────────────────────────────────
// retry:1 previously retried every failure once, including definitively
// non-retryable 4xx responses — doubling latency-to-error and re-running the
// 401 session-invalidation path against an authorization boundary.

describe('retryQuery', () => {
  it.each([400, 401, 403, 404, 409, 422])('never retries a %d (4xx) response', (status) => {
    expect(retryQuery(0, axiosErrorWithStatus(status))).toBe(false)
  })

  it.each([500, 502, 503])('retries a %d (5xx) response once', (status) => {
    expect(retryQuery(0, axiosErrorWithStatus(status))).toBe(true)
    expect(retryQuery(1, axiosErrorWithStatus(status))).toBe(false)
  })

  it('retries a network error (no response) once', () => {
    const networkError = new AxiosError('Network Error')
    expect(retryQuery(0, networkError)).toBe(true)
    expect(retryQuery(1, networkError)).toBe(false)
  })

  it('retries a non-axios error once', () => {
    expect(retryQuery(0, new Error('boom'))).toBe(true)
    expect(retryQuery(1, new Error('boom'))).toBe(false)
  })

  it('is wired into the shared query client defaults', () => {
    expect(queryClient.getDefaultOptions().queries?.retry).toBe(retryQuery)
  })
})
