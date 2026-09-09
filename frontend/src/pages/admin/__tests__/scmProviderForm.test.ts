import { describe, it, expect } from 'vitest'

import {
  certificateFieldsApply,
  entraCredentialTypeOf,
  federatedFieldsApply,
  isSCMProviderSubmitBlocked,
  secretFieldsApply,
} from '../scmProviderForm'
import type { CreateSCMProviderRequest } from '../../../types/scm'

const create = (form: Partial<CreateSCMProviderRequest>) =>
  isSCMProviderSubmitBlocked(form, { isEditing: false })
const edit = (form: Partial<CreateSCMProviderRequest>, providerType?: 'azuredevops' | 'github') =>
  isSCMProviderSubmitBlocked(form, { isEditing: true, providerType })

const adoSecret: Partial<CreateSCMProviderRequest> = {
  name: 'ado',
  provider_type: 'azuredevops',
  auth_mode: 'entra_app',
  base_url: 'https://dev.azure.com/acme',
  tenant_id: 'tenant-1',
  client_id: 'client-1',
  client_secret: 's3cr3t',
}

const adoFederated: Partial<CreateSCMProviderRequest> = {
  name: 'ado-fed',
  provider_type: 'azuredevops',
  auth_mode: 'entra_app',
  entra_credential_type: 'federated',
  base_url: 'https://dev.azure.com/acme',
  client_id: 'federated-client-1',
}

describe('entraCredentialTypeOf', () => {
  // Every provider written before the backend column existed carries the column
  // default, so absent and 'client_secret' have to be the same thing. Reading
  // absent as anything else would reclassify the entire installed base.
  it('defaults an absent value to client_secret', () => {
    expect(entraCredentialTypeOf({})).toBe('client_secret')
    expect(entraCredentialTypeOf({ entra_credential_type: undefined })).toBe('client_secret')
  })

  it('preserves an explicit value', () => {
    expect(entraCredentialTypeOf({ entra_credential_type: 'federated' })).toBe('federated')
    expect(entraCredentialTypeOf({ entra_credential_type: 'client_secret' })).toBe('client_secret')
  })
})

describe('federatedFieldsApply', () => {
  it('is true for the secret-bearing types, false for federated', () => {
    expect(federatedFieldsApply({})).toBe(true)
    expect(federatedFieldsApply({ entra_credential_type: 'client_secret' })).toBe(true)
    expect(federatedFieldsApply({ entra_credential_type: 'federated' })).toBe(false)
  })
})

// #907 — azuredevops used to fall through to a client_id/client_secret check,
// so a provider could be submitted with no tenant id and no base URL. The
// operator got a raw 400, or for base_url a provider that saved and could then
// reach nothing.
describe('isSCMProviderSubmitBlocked — Azure DevOps with a client secret', () => {
  it('allows a complete form', () => {
    expect(create(adoSecret)).toBe(false)
  })

  it('blocks a missing base URL', () => {
    // The organization lives in the base URL's first path segment; without one
    // the backend cannot name an organization at all.
    expect(create({ ...adoSecret, base_url: undefined })).toBe(true)
    expect(create({ ...adoSecret, base_url: null })).toBe(true)
    expect(create({ ...adoSecret, base_url: '' })).toBe(true)
  })

  it('blocks a missing tenant id', () => {
    expect(create({ ...adoSecret, tenant_id: undefined })).toBe(true)
    expect(create({ ...adoSecret, tenant_id: null })).toBe(true)
  })

  it('blocks a missing client id', () => {
    expect(create({ ...adoSecret, client_id: '' })).toBe(true)
  })

  it('requires a secret on create but not on edit', () => {
    expect(create({ ...adoSecret, client_secret: '' })).toBe(true)
    // On edit the stored secret is never returned, so a blank field means
    // "unchanged" — requiring it would make every edit demand a re-type.
    expect(edit({ ...adoSecret, client_secret: '' }, 'azuredevops')).toBe(false)
  })
})

// #908 — a federated provider carries neither a tenant id nor a secret. The
// backend rejects both if sent, so requiring them here would make the mode
// unreachable from the UI entirely.
describe('isSCMProviderSubmitBlocked — Azure DevOps with workload identity', () => {
  it('allows a form with only a client id and base URL', () => {
    expect(create(adoFederated)).toBe(false)
  })

  it('does not require a tenant id', () => {
    expect(create({ ...adoFederated, tenant_id: null })).toBe(false)
  })

  it('does not require a client secret, on create or edit', () => {
    expect(create({ ...adoFederated, client_secret: '' })).toBe(false)
    expect(edit({ ...adoFederated, client_secret: '' }, 'azuredevops')).toBe(false)
  })

  it('still requires the client id, which is the whole credential', () => {
    expect(create({ ...adoFederated, client_id: '' })).toBe(true)
  })

  it('still requires the base URL', () => {
    expect(create({ ...adoFederated, base_url: null })).toBe(true)
  })
})

// #1041 — a certificate provider signs an assertion with a held key. It needs
// a tenant (the assertion names it) and the bundle, and must not carry a
// secret; the backend refuses one sent alongside.
const adoCertificate: Partial<CreateSCMProviderRequest> = {
  name: 'ado-cert',
  provider_type: 'azuredevops',
  auth_mode: 'entra_app',
  entra_credential_type: 'certificate',
  base_url: 'https://dev.azure.com/acme',
  tenant_id: 'tenant-1',
  client_id: 'client-1',
  entra_certificate: '-----BEGIN CERTIFICATE-----',
}

describe('field applicability per credential type', () => {
  it('only client_secret collects a secret; only certificate collects a bundle', () => {
    expect(secretFieldsApply({})).toBe(true)
    expect(secretFieldsApply({ entra_credential_type: 'client_secret' })).toBe(true)
    expect(secretFieldsApply({ entra_credential_type: 'federated' })).toBe(false)
    expect(secretFieldsApply({ entra_credential_type: 'certificate' })).toBe(false)

    expect(certificateFieldsApply({})).toBe(false)
    expect(certificateFieldsApply({ entra_credential_type: 'certificate' })).toBe(true)
    expect(certificateFieldsApply({ entra_credential_type: 'federated' })).toBe(false)
  })

  it('a certificate provider still has a tenant id', () => {
    // Unlike federated: the signed assertion names the tenant.
    expect(federatedFieldsApply({ entra_credential_type: 'certificate' })).toBe(true)
  })
})

describe('isSCMProviderSubmitBlocked — Azure DevOps with a certificate', () => {
  it('allows a complete form', () => {
    expect(create(adoCertificate)).toBe(false)
  })

  it('requires the bundle on create but not on edit', () => {
    expect(create({ ...adoCertificate, entra_certificate: '' })).toBe(true)
    // On edit the stored bundle is never returned, so blank means unchanged.
    expect(edit({ ...adoCertificate, entra_certificate: '' }, 'azuredevops')).toBe(false)
  })

  it('does not require a client secret', () => {
    expect(create({ ...adoCertificate, client_secret: '' })).toBe(false)
  })

  it('still requires a tenant id, a client id and a base URL', () => {
    expect(create({ ...adoCertificate, tenant_id: null })).toBe(true)
    expect(create({ ...adoCertificate, client_id: '' })).toBe(true)
    expect(create({ ...adoCertificate, base_url: null })).toBe(true)
  })
})

describe('isSCMProviderSubmitBlocked — the other provider shapes are unchanged', () => {
  it('always requires a name', () => {
    expect(create({})).toBe(true)
    expect(create({ ...adoSecret, name: '' })).toBe(true)
  })

  it('bitbucket_dc needs only a name and base URL', () => {
    expect(create({ name: 'bb', provider_type: 'bitbucket_dc', base_url: 'https://bb' })).toBe(
      false,
    )
    expect(create({ name: 'bb', provider_type: 'bitbucket_dc' })).toBe(true)
  })

  it('a github app needs its app id, installation id and key on create', () => {
    const ghApp: Partial<CreateSCMProviderRequest> = {
      name: 'gh',
      provider_type: 'github',
      auth_mode: 'github_app',
      github_app_id: '1',
      github_installation_id: '2',
      app_private_key: 'k',
    }
    expect(create(ghApp)).toBe(false)
    expect(create({ ...ghApp, github_app_id: '' })).toBe(true)
    expect(create({ ...ghApp, github_installation_id: '' })).toBe(true)
    expect(create({ ...ghApp, app_private_key: '' })).toBe(true)
    expect(edit({ ...ghApp, app_private_key: '' }, 'github')).toBe(false)
  })

  it('github oauth needs a client id, and a secret only on create', () => {
    const ghOauth: Partial<CreateSCMProviderRequest> = {
      name: 'gh',
      provider_type: 'github',
      client_id: 'c',
      client_secret: 's',
    }
    expect(create(ghOauth)).toBe(false)
    expect(create({ ...ghOauth, client_id: '' })).toBe(true)
    expect(create({ ...ghOauth, client_secret: '' })).toBe(true)
    expect(edit({ ...ghOauth, client_secret: '' }, 'github')).toBe(false)
  })

  // The credential type only means anything for entra_app. A github provider
  // that somehow carries one must not have its secret requirement relaxed.
  it('ignores a stray credential type on a non-entra provider', () => {
    expect(
      create({
        name: 'gh',
        provider_type: 'github',
        client_id: 'c',
        client_secret: '',
        entra_credential_type: 'federated',
      }),
    ).toBe(true)
  })
})
