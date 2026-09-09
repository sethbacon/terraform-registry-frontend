import type {
  CreateSCMProviderRequest,
  SCMEntraCredentialType,
  SCMProviderType,
} from '../../types/scm'

/**
 * Providers authenticated with a personal access token rather than an app.
 *
 * Mirrors the page's own predicate exactly. GitLab is deliberately NOT here:
 * it uses the OAuth client-id/secret path in this codebase, and widening this
 * would silently change which fields GitLab requires -- a separate decision
 * from #907/#908.
 */
export function isPATProviderType(type?: SCMProviderType): boolean {
  return type === 'bitbucket_dc'
}

/**
 * The credential type an entra_app provider is using, defaulting the absent
 * case. Every provider written before the column existed carries the column
 * default, so "not set" and "client_secret" are the same thing.
 */
export function entraCredentialTypeOf(
  form: Pick<Partial<CreateSCMProviderRequest>, 'entra_credential_type'>,
): SCMEntraCredentialType {
  return form.entra_credential_type || 'client_secret'
}

/**
 * Whether the Azure DevOps credential fields apply to this form.
 *
 * A federated provider proves itself with a platform-projected token, so it
 * carries neither a tenant id nor a client secret -- the workload-identity
 * webhook supplies AZURE_TENANT_ID beside the token, and the row records only
 * WHICH identity to assume. The backend refuses both if sent, so the form must
 * not collect them.
 */
export function federatedFieldsApply(form: Partial<CreateSCMProviderRequest>): boolean {
  return entraCredentialTypeOf(form) !== 'federated'
}

/**
 * isSCMProviderSubmitBlocked decides whether the Create/Update button is
 * disabled, and is the single place the per-provider field rules live.
 *
 * Extracted from an inline IIFE so the rules can be asserted directly. The
 * previous version fell through to a client_id/client_secret check for
 * `azuredevops`, which meant an ADO provider could be submitted with no tenant
 * id and no base URL and come back as a raw 400 (#907) -- or, for base URL,
 * as a provider that saved and then could not reach anything (registry-backend
 * #1036).
 */
export function isSCMProviderSubmitBlocked(
  form: Partial<CreateSCMProviderRequest>,
  opts: { providerType?: SCMProviderType; isEditing: boolean },
): boolean {
  const { providerType, isEditing } = opts
  if (!form.name) return true

  const ptype = providerType || form.provider_type
  const authMode = form.auth_mode || 'oauth_user'

  if (isPATProviderType(ptype)) return !form.base_url

  if (ptype === 'github' && authMode === 'github_app') {
    return (
      !form.github_app_id || !form.github_installation_id || (!isEditing && !form.app_private_key)
    )
  }

  if (ptype === 'azuredevops') {
    // The organization lives in the base URL's first path segment, so without
    // one the backend cannot name an organization at all and every call is
    // built against a bare host (registry-backend #1036).
    if (!form.base_url) return true

    if (!form.client_id) return true

    if (authMode === 'entra_app' && !federatedFieldsApply(form)) {
      // Federated: the client id above is the whole credential.
      return false
    }
    // Everything else on Azure DevOps needs a tenant, and a secret on create.
    if (!form.tenant_id) return true
    return !isEditing && !form.client_secret
  }

  return !form.client_id || (!isEditing && !form.client_secret)
}
