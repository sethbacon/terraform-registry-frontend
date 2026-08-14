import { describe, it, expect, vi, afterEach } from 'vitest'
import type { AxiosResponse } from 'axios'
import { http } from '../http'
import {
  listPlatformAdmins,
  grantPlatformAdmin,
  revokePlatformAdmin,
  PLATFORM_ADMIN_NOTE_MAX_LENGTH,
} from '../platformAdminsApi'

function axiosResponse<T>(data: T): AxiosResponse<T> {
  return { data } as AxiosResponse<T>
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('listPlatformAdmins', () => {
  it('unwraps the platform_admins envelope', async () => {
    const grant = {
      user_id: 'u-1',
      email: 'alice@example.com',
      name: 'Alice Admin',
      user_resolved: true,
      granted_by: 'u-2',
      granted_by_email: 'bob@example.com',
      granted_at: '2026-07-01T10:00:00Z',
      note: 'Runs the platform',
    }
    const getSpy = vi
      .spyOn(http, 'get')
      .mockResolvedValue(axiosResponse({ platform_admins: [grant] }))

    await expect(listPlatformAdmins()).resolves.toEqual([grant])
    expect(getSpy).toHaveBeenCalledWith('/api/v1/admin/platform-admins')
  })

  it('returns an empty list when the envelope has no grants', async () => {
    vi.spyOn(http, 'get').mockResolvedValue(axiosResponse({}))
    await expect(listPlatformAdmins()).resolves.toEqual([])
  })
})

describe('grantPlatformAdmin', () => {
  it('posts the user id and note, and unwraps the created grant', async () => {
    const created = {
      user_id: 'u-3',
      email: 'carol@example.com',
      name: 'Carol Newcomer',
      user_resolved: true,
      granted_by: 'u-2',
      granted_at: '2026-08-01T12:00:00Z',
      note: 'On call rotation',
    }
    const postSpy = vi
      .spyOn(http, 'post')
      .mockResolvedValue(axiosResponse({ platform_admin: created }))

    await expect(grantPlatformAdmin({ user_id: 'u-3', note: 'On call rotation' })).resolves.toEqual(
      created,
    )
    expect(postSpy).toHaveBeenCalledWith('/api/v1/admin/platform-admins', {
      user_id: 'u-3',
      note: 'On call rotation',
    })
  })
})

describe('revokePlatformAdmin', () => {
  it('deletes the grant under an encoded user id', async () => {
    const deleteSpy = vi
      .spyOn(http, 'delete')
      .mockResolvedValue(axiosResponse({ message: 'Platform administrator revoked' }))

    await expect(revokePlatformAdmin('u-1/../admin')).resolves.toEqual({
      message: 'Platform administrator revoked',
    })
    expect(deleteSpy).toHaveBeenCalledWith('/api/v1/admin/platform-admins/u-1%2F..%2Fadmin')
  })
})

describe('PLATFORM_ADMIN_NOTE_MAX_LENGTH', () => {
  it('matches the backend bound (admin.maxPlatformAdminNoteLen)', () => {
    expect(PLATFORM_ADMIN_NOTE_MAX_LENGTH).toBe(500)
  })
})
