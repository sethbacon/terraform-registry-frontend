import { describe, it, expect } from 'vitest'

import { buildUpdateSCMProviderPayload } from '../scmProviderPayload'
import type { CreateSCMProviderRequest } from '../../../types/scm'

// #909 — the edit dialog blanks the write-only credentials on open, because the
// stored values are never returned, and tells the operator that leaving them
// blank keeps what is stored. Sending that blank as "" made the claim false.
//
// These assert on the KEYS PRESENT in the payload, not on a success response. A
// test that only checked for a 200 would have passed against the broken version:
// for an oauth_user provider the destructive request succeeds.

// A form as the edit dialog leaves it: everything populated from the provider,
// both credentials blank because they are never returned.
const untouchedEditForm: Partial<CreateSCMProviderRequest> = {
  name: 'ado-prod',
  base_url: 'https://dev.azure.com/acme',
  tenant_id: 'tenant-1',
  client_id: 'client-1',
  client_secret: '',
  webhook_secret: 'wh',
  auth_mode: 'entra_app',
  github_app_id: '',
  github_installation_id: '',
  app_private_key: '',
}

describe('buildUpdateSCMProviderPayload', () => {
  it('omits an untouched client secret rather than sending an empty one', () => {
    const payload = buildUpdateSCMProviderPayload(untouchedEditForm)

    // `in` rather than a truthiness check: '' and undefined are both falsy, and
    // only one of them is destructive on the wire.
    expect('client_secret' in payload).toBe(false)
    expect('app_private_key' in payload).toBe(false)
  })

  it('still sends the fields that are safe to round-trip', () => {
    const payload = buildUpdateSCMProviderPayload(untouchedEditForm)

    expect(payload).toMatchObject({
      name: 'ado-prod',
      base_url: 'https://dev.azure.com/acme',
      tenant_id: 'tenant-1',
      client_id: 'client-1',
      webhook_secret: 'wh',
      auth_mode: 'entra_app',
    })
  })

  it('sends a secret the operator actually typed', () => {
    const payload = buildUpdateSCMProviderPayload({
      ...untouchedEditForm,
      client_secret: 'rotated-secret',
    })

    expect(payload.client_secret).toBe('rotated-secret')
  })

  it('sends an empty string only when removal was asked for explicitly', () => {
    const payload = buildUpdateSCMProviderPayload(untouchedEditForm, { clientSecret: true })

    expect('client_secret' in payload).toBe(true)
    expect(payload.client_secret).toBe('')
  })

  it('prefers removal over a typed value, so a stale keystroke cannot defeat it', () => {
    // The field is disabled once removal is checked, but the previously typed
    // value is still in form state. Removal has to win, or the operator sees a
    // disabled empty box and silently rotates the secret instead of clearing it.
    const payload = buildUpdateSCMProviderPayload(
      { ...untouchedEditForm, client_secret: 'left-over' },
      { clientSecret: true },
    )

    expect(payload.client_secret).toBe('')
  })

  it('treats the two credentials independently', () => {
    const payload = buildUpdateSCMProviderPayload(
      { ...untouchedEditForm, app_private_key: '-----BEGIN RSA PRIVATE KEY-----' },
      { clientSecret: true },
    )

    expect(payload.client_secret).toBe('')
    expect(payload.app_private_key).toBe('-----BEGIN RSA PRIVATE KEY-----')
  })

  it('omits an untouched private key while removing the client secret', () => {
    const payload = buildUpdateSCMProviderPayload(untouchedEditForm, { clientSecret: true })

    expect('app_private_key' in payload).toBe(false)
  })

  it('handles the github_app shape: private key removed, secret untouched', () => {
    const payload = buildUpdateSCMProviderPayload(
      {
        name: 'gh-app',
        client_id: '',
        client_secret: '',
        auth_mode: 'github_app',
        github_app_id: '12345',
        github_installation_id: '67890',
        app_private_key: '',
      },
      { appPrivateKey: true },
    )

    expect(payload.app_private_key).toBe('')
    expect('client_secret' in payload).toBe(false)
    expect(payload.github_app_id).toBe('12345')
  })

  it('defaults to no removal when no flags are given', () => {
    const payload = buildUpdateSCMProviderPayload({ name: 'n' })

    expect('client_secret' in payload).toBe(false)
    expect('app_private_key' in payload).toBe(false)
  })
})
