// SCM Integration Types

export type SCMProviderType = 'github' | 'azuredevops' | 'gitlab' | 'bitbucket_dc';

export interface SCMProvider {
  id: string;
  organization_id: string;
  provider_type: SCMProviderType;
  name: string;
  base_url?: string | null;
  tenant_id?: string | null;
  client_id: string;
  webhook_secret?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateSCMProviderRequest {
  organization_id: string;
  provider_type: SCMProviderType;
  name: string;
  base_url?: string | null;
  tenant_id?: string | null;
  client_id?: string;
  client_secret?: string;
  webhook_secret?: string;
}

export interface UpdateSCMProviderRequest {
  name?: string;
  base_url?: string | null;
  tenant_id?: string | null;
  client_id?: string;
  client_secret?: string;
  webhook_secret?: string;
  is_active?: boolean;
}

export interface SCMOAuthToken {
  id: string;
  user_id: string;
  provider_id: string;
  token_type: string;
  scopes: string[];
  expires_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface OAuthInitiateResponse {
  authorization_url: string;
  state: string;
}

export interface SCMRepository {
  id: string;
  name: string;
  full_name: string;
  owner: string;
  description?: string;
  default_branch: string;
  clone_url: string;
  html_url: string;
  private: boolean;
}

export interface SCMTag {
  tag_name: string;
  target_commit: string;
  annotation_msg?: string;
  tagger_name?: string;
  tagged_at?: string;
}

export interface SCMBranch {
  branch_name: string;
  head_commit: string;
  is_protected: boolean;
  is_main_branch?: boolean;
}

export interface ModuleSCMLink {
  id: string;
  module_id: string;
  provider_id: string;
  repository_owner: string;
  repository_name: string;
  repository_path?: string;
  default_branch: string;
  auto_publish_enabled: boolean;
  tag_pattern?: string;
  webhook_id?: string;
  webhook_url?: string;
  webhook_secret: string;
  last_sync_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateModuleSCMLinkRequest {
  provider_id: string;
  repository_owner: string;
  repository_name: string;
  repository_path?: string;
  default_branch?: string;
  auto_publish_enabled?: boolean;
  tag_pattern?: string;
}

export interface UpdateModuleSCMLinkRequest {
  repository_path?: string;
  default_branch?: string;
  auto_publish_enabled?: boolean;
  tag_pattern?: string;
}

export interface SCMWebhookEvent {
  id: string;
  module_source_repo_id: string;
  event_type: string;
  ref_name: string;
  commit_sha: string;
  payload: Record<string, any>;
  state: 'pending' | 'processing' | 'succeeded' | 'failed';
  error_message?: string | null;
  version_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ImmutabilityViolation {
  id: string;
  module_version_id: string;
  tag_name: string;
  original_commit_sha: string;
  new_commit_sha: string;
  detected_at: string;
  acknowledged: boolean;
  acknowledged_by?: string | null;
  acknowledged_at?: string | null;
  note?: string | null;
}

export interface ManualSyncRequest {
  tag_name?: string;
  commit_sha?: string;
}

export interface ManualSyncResponse {
  message: string;
  webhook_event_id: string;
}

// Helper type for provider-specific configurations
export interface ProviderConfig {
  github?: {
    app_id?: string;
    installation_id?: string;
  };
  azure_devops?: {
    organization: string;
    project?: string;
  };
  gitlab?: {
    group_id?: string;
  };
  bitbucket_dc?: {
    project_key?: string;
  };
}
