// SCM Integration Types

export type SCMProviderType = 'github' | 'azuredevops' | 'gitlab' | 'bitbucket_dc'

export type SCMAuthMode = 'oauth_user' | 'entra_app' | 'github_app'

export interface SCMProvider {
  id: string
  organization_id: string
  provider_type: SCMProviderType
  name: string
  base_url?: string | null
  tenant_id?: string | null
  client_id: string
  webhook_secret?: string
  is_active: boolean
  created_at: string
  updated_at: string
  auth_mode?: SCMAuthMode
  github_app_id?: string | null
  github_installation_id?: string | null
  has_client_secret?: boolean
  has_app_private_key?: boolean
}

export interface CreateSCMProviderRequest {
  organization_id: string
  provider_type: SCMProviderType
  name: string
  base_url?: string | null
  tenant_id?: string | null
  client_id?: string
  client_secret?: string
  webhook_secret?: string
  auth_mode?: SCMAuthMode
  github_app_id?: string
  github_installation_id?: string
  app_private_key?: string
}

export interface UpdateSCMProviderRequest {
  name?: string
  base_url?: string | null
  tenant_id?: string | null
  client_id?: string
  client_secret?: string
  webhook_secret?: string
  is_active?: boolean
  auth_mode?: SCMAuthMode
  github_app_id?: string
  github_installation_id?: string
  app_private_key?: string
}

export interface SCMProviderVerifyResult {
  ok: boolean
  expires_at?: string | null
}

export interface SCMOAuthToken {
  id: string
  user_id: string
  provider_id: string
  token_type: string
  scopes: string[]
  expires_at?: string | null
  created_at: string
  updated_at: string
}

export interface OAuthInitiateResponse {
  authorization_url: string
  state: string
}

export interface SCMRepository {
  id: string
  name: string
  full_name: string
  owner: string
  description?: string
  default_branch: string
  clone_url: string
  html_url: string
  private: boolean
}

/** Git tag as returned by the repository tags endpoint (backend scm.Tag). */
export interface SCMTag {
  name: string
  commit_sha: string
  message: string
  tagger: string
  created_at: string
}

/** Git branch as returned by the repository branches endpoint (backend scm.Branch). */
export interface SCMBranch {
  name: string
  commit_sha: string
  protected: boolean
  default: boolean
}

/**
 * SCM link for a module as returned by GET /api/v1/admin/modules/{id}/scm
 * (backend scm.ModuleSCMRepo, marshaled bare). Note the field names differ
 * from CreateModuleSCMLinkRequest below — the create/update REQUESTS use
 * provider_id/repository_path, the RESPONSE uses scm_provider_id/module_path.
 * The webhook secret is never sent to the frontend.
 */
export interface ModuleSCMLink {
  id: string
  module_id: string
  scm_provider_id: string
  repository_owner: string
  repository_name: string
  repository_url?: string
  default_branch: string
  module_path: string
  tag_pattern: string
  auto_publish_enabled: boolean
  webhook_id?: string
  webhook_url?: string
  webhook_enabled: boolean
  last_sync_at?: string | null
  last_sync_commit?: string | null
  created_at: string
  updated_at: string
}

export interface CreateModuleSCMLinkRequest {
  provider_id: string
  repository_owner: string
  repository_name: string
  repository_path?: string
  default_branch?: string
  auto_publish_enabled?: boolean
  tag_pattern?: string
}

export interface UpdateModuleSCMLinkRequest {
  repository_path?: string
  default_branch?: string
  auto_publish_enabled?: boolean
  tag_pattern?: string
}

/**
 * Webhook event as returned by GET /api/v1/admin/modules/{id}/scm/events
 * (backend scm.SCMWebhookEvent). There is no server-side `state` field —
 * derive a display status from `processed` / `processing_started_at` / `error`.
 */
export interface SCMWebhookEvent {
  id: string
  module_scm_repo_id: string
  event_id?: string
  event_type: string
  ref?: string
  commit_sha?: string
  tag_name?: string
  payload: Record<string, unknown>
  headers?: Record<string, unknown>
  signature?: string
  signature_valid?: boolean
  processed: boolean
  processing_started_at?: string | null
  processed_at?: string | null
  result_version_id?: string | null
  error?: string | null
  retry_count: number
  max_retries: number
  next_retry_at?: string | null
  last_error?: string | null
  created_at: string
}

export interface ImmutabilityViolation {
  id: string
  module_version_id: string
  tag_name: string
  original_commit_sha: string
  new_commit_sha: string
  detected_at: string
  acknowledged: boolean
  acknowledged_by?: string | null
  acknowledged_at?: string | null
  note?: string | null
}

export interface ManualSyncRequest {
  tag_name?: string
  commit_sha?: string
}

/** POST /api/v1/admin/modules/{id}/scm/sync returns 202 with a message only. */
export interface ManualSyncResponse {
  message: string
}

// Helper type for provider-specific configurations
export interface ProviderConfig {
  github?: {
    app_id?: string
    installation_id?: string
  }
  azure_devops?: {
    organization: string
    project?: string
  }
  gitlab?: {
    group_id?: string
  }
  bitbucket_dc?: {
    project_key?: string
  }
}
