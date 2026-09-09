import type { CreateSCMProviderRequest, UpdateSCMProviderRequest } from '../../types/scm'

/**
 * Which stored credentials the operator asked to remove outright.
 *
 * Separate from the form fields because "" has to mean two different things on
 * the wire: an absent key leaves the stored credential alone, and an explicit
 * empty string retires it. The form cannot express that with one value, since a
 * blank field is also what an untouched field looks like.
 */
export interface SCMSecretClearFlags {
  clientSecret?: boolean
  appPrivateKey?: boolean
}

/**
 * buildUpdateSCMProviderPayload assembles the PUT body for an SCM provider.
 *
 * The rule for every write-only credential is: send it when the operator typed
 * one, send "" when they asked to remove it, and OMIT IT ENTIRELY otherwise.
 *
 * Omitting matters. The edit dialog blanks these fields on open, because the
 * stored values are never returned, and tells the operator that leaving them
 * blank keeps what is stored. Sending that blank as "" made the claim false:
 * the API reads "" as a value, not an absence. For an entra_app provider that
 * is a 400; for an oauth_user provider the request SUCCEEDS and the stored
 * OAuth client secret is destroyed, with the failure surfacing later at the
 * next token exchange (#909).
 *
 * The non-credential fields are always sent, which is unchanged: they are
 * populated from the provider on open, so submitting them round-trips the
 * current value rather than clearing anything.
 */
export function buildUpdateSCMProviderPayload(
  form: Partial<CreateSCMProviderRequest>,
  clear: SCMSecretClearFlags = {},
): UpdateSCMProviderRequest {
  const payload: UpdateSCMProviderRequest = {
    name: form.name,
    base_url: form.base_url,
    tenant_id: form.tenant_id,
    client_id: form.client_id,
    webhook_secret: form.webhook_secret,
    auth_mode: form.auth_mode,
    entra_credential_type: form.entra_credential_type,
    github_app_id: form.github_app_id,
    github_installation_id: form.github_installation_id,
  }

  if (clear.clientSecret) {
    payload.client_secret = ''
  } else if (form.client_secret) {
    payload.client_secret = form.client_secret
  }

  if (clear.appPrivateKey) {
    payload.app_private_key = ''
  } else if (form.app_private_key) {
    payload.app_private_key = form.app_private_key
  }

  return payload
}
