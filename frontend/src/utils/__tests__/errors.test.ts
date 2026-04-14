import { describe, it, expect } from 'vitest'
import { AxiosError, AxiosHeaders } from 'axios'
import { getErrorMessage, getErrorStatus } from '../errors'

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
