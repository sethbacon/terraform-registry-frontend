import { http } from './http'

// ============================================================================
// Development-Only Endpoints (disabled in production)
// ============================================================================

export async function getDevStatus(): Promise<{ dev_mode: boolean; message?: string }> {
  const response = await http.get('/api/v1/dev/status')
  return response.data
}

// Sets the HttpOnly auth cookie (plus tfr_csrf) via Set-Cookie; no token in the body.
export async function devLogin(): Promise<{
  user: Record<string, unknown>
  expires_in: number
}> {
  const response = await http.post('/api/v1/dev/login')
  return response.data
}

export async function listUsersForImpersonation(): Promise<{
  users: Array<{
    id: string
    email: string
    name: string
    primary_role: string
  }>
  dev_mode: boolean
}> {
  const response = await http.get('/api/v1/dev/users')
  return response.data
}

// Swaps the HttpOnly auth cookie to the impersonated user; no token in the body.
export async function impersonateUser(userId: string): Promise<{
  user: {
    id: string
    email: string
    name: string
  }
  message: string
}> {
  const response = await http.post(`/api/v1/dev/impersonate/${userId}`)
  return response.data
}
