/**
 * Platform-admin carrier API — the grant table that holds platform-admin
 * authority outside of role templates (backend issue #766).
 *
 * Every route is gated on the `admin` scope. The list deliberately includes
 * grants whose user no longer resolves (`user_resolved: false`); see the
 * PlatformAdmin type.
 */
import { http, encodeSegment } from './http'
import type { PlatformAdmin } from '../../types/rbac'

/** Longest note the backend accepts on a grant (admin.maxPlatformAdminNoteLen). */
export const PLATFORM_ADMIN_NOTE_MAX_LENGTH = 500

export async function listPlatformAdmins(): Promise<PlatformAdmin[]> {
  const response = await http.get<{ platform_admins?: PlatformAdmin[] }>(
    '/api/v1/admin/platform-admins',
  )
  return response.data.platform_admins || []
}

/**
 * Grant platform-admin authority. The backend answers 404 for an unknown user,
 * 409 when the user already holds the grant, and 400 for a malformed user_id or
 * an over-long note.
 */
export async function grantPlatformAdmin(data: {
  user_id: string
  note?: string
}): Promise<PlatformAdmin> {
  const response = await http.post<{ platform_admin: PlatformAdmin }>(
    '/api/v1/admin/platform-admins',
    data,
  )
  return response.data.platform_admin
}

/**
 * Revoke platform-admin authority.
 *
 * 409 is not a malformed request: it is the never-zero invariant refusing to
 * strand the deployment without an administrator. Callers must surface that
 * case as an explanation rather than as a failure the operator caused.
 */
export async function revokePlatformAdmin(userId: string): Promise<{ message: string }> {
  const response = await http.delete<{ message: string }>(
    `/api/v1/admin/platform-admins/${encodeSegment(userId)}`,
  )
  return response.data
}
