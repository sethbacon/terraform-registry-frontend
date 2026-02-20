export interface User {
  id: string;
  email: string;
  name: string;
  username?: string; // Alias for name for UI purposes
  role?: string; // Deprecated: use memberships for per-org roles
  organization_name?: string; // Associated organization
  oidc_sub?: string;
  created_at: string;
  updated_at: string;
}

export interface RoleTemplate {
  id: string;
  name: string;
  display_name: string;
  description?: string;
  scopes: string[];
  is_system?: boolean;
}

export interface RoleTemplateInfo {
  id?: string;
  name: string;
  display_name: string;
  scopes?: string[];
}

export interface Organization {
  id: string;
  name: string;
  display_name: string;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMember {
  organization_id: string;
  user_id: string;
  role_template_id?: string;
  created_at: string;
}

export interface OrganizationMemberWithUser {
  organization_id: string;
  user_id: string;
  role_template_id?: string;
  role_template_name?: string;
  role_template_display_name?: string;
  role_template_scopes?: string[];
  created_at: string;
  user_name: string;
  user_email: string;
}

export interface UserMembership {
  organization_id: string;
  organization_name: string;
  role_template_id?: string;
  role_template_name?: string;
  role_template_display_name?: string;
  role_template_scopes?: string[];
  role_template?: RoleTemplateInfo;
  created_at: string;
}

export interface APIKey {
  id: string;
  user_id?: string;
  user_name?: string; // User name who created this key (joined from users table)
  organization_id: string;
  name: string;
  description?: string;
  key_prefix: string;
  scopes: string[];
  expires_at?: string;
  last_used_at?: string;
  created_at: string;
}

export interface RotateAPIKeyResponse {
  new_key: {
    id: string;
    name: string;
    key: string;
    key_prefix: string;
    scopes: string[];
    expires_at?: string;
    created_at: string;
  };
  old_key_status: string;
  old_expires_at?: string;
}

export interface Module {
  id: string;
  namespace: string;
  name: string;
  system: string;
  provider?: string; // Alias for system for backward compatibility
  description?: string;
  source?: string;
  organization_id?: string;
  organization_name?: string;
  latest_version?: string; // Latest version string
  download_count?: number; // Total downloads
  versions?: ModuleVersion[]; // Embedded versions from getModule API
  created_by?: string; // User ID who created this module
  created_by_name?: string; // User name who created this module
  created_at: string;
  updated_at: string;
}

export interface ModuleVersion {
  id: string;
  module_id: string;
  version: string;
  storage_path?: string;
  storage_backend?: string;
  size_bytes?: number;
  checksum?: string;
  readme?: string;
  download_count: number;
  deprecated?: boolean;
  deprecated_at?: string;
  deprecation_message?: string;
  published_by?: string; // User ID who published this version
  published_by_name?: string; // User name who published this version
  published_at?: string;
  created_at?: string;
}

export interface Provider {
  id: string;
  namespace: string;
  type: string;
  description?: string;
  source?: string;
  organization_id: string;
  organization_name?: string;
  latest_version?: string; // Latest version string
  download_count?: number; // Total downloads
  created_by?: string; // User ID who created this provider
  created_by_name?: string; // User name who created this provider
  created_at: string;
  updated_at: string;
}

export interface ProviderPlatform {
  id: string;
  provider_version_id: string;
  os: string;
  arch: string;
  filename: string;
  storage_path: string;
  storage_backend: string;
  size_bytes: number;
  shasum: string;
  download_count: number;
}

export interface ProviderVersion {
  id: string;
  provider_id: string;
  version: string;
  protocols: string[];
  gpg_public_key: string;
  shasums_url: string;
  shasums_signature_url: string;
  published_by?: string; // User ID who published this version
  published_by_name?: string; // User name who published this version
  published_at: string;
  download_count?: number;
  platforms?: ProviderPlatform[];
  deprecated?: boolean;
  deprecated_at?: string;
  deprecation_message?: string;
  created_at: string;
}

export interface ProviderPlatform {
  id: string;
  provider_version_id: string;
  os: string;
  arch: string;
  filename: string;
  size_bytes: number;
  shasum: string;
  download_count: number;
}

export interface PaginationMeta {
  page: number;
  per_page: number;
  total: number;
}

export interface AuthContextType {
  user: User | null;
  roleTemplate: RoleTemplateInfo | null; // Primary role template (backward compat)
  allowedScopes: string[]; // Combined scopes across all org memberships
  memberships?: UserMembership[]; // Per-org memberships with role templates
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (userOrProvider: User | 'oidc' | 'azuread') => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
  setToken: (token: string) => void; // For dev mode impersonation
}

// Storage Configuration Types
export type StorageBackendType = 'local' | 'azure' | 's3' | 'gcs';

export interface StorageConfigResponse {
  id: string;
  backend_type: StorageBackendType;
  is_active: boolean;

  // Local storage settings
  local_base_path?: string;
  local_serve_directly?: boolean;

  // Azure Blob Storage settings
  azure_account_name?: string;
  azure_account_key_set: boolean;
  azure_container_name?: string;
  azure_cdn_url?: string;

  // S3 settings
  s3_endpoint?: string;
  s3_region?: string;
  s3_bucket?: string;
  s3_auth_method?: string;
  s3_access_key_id_set: boolean;
  s3_secret_access_key_set: boolean;
  s3_role_arn?: string;
  s3_role_session_name?: string;
  s3_external_id?: string;
  s3_web_identity_token_file?: string;

  // GCS settings
  gcs_bucket?: string;
  gcs_project_id?: string;
  gcs_auth_method?: string;
  gcs_credentials_file?: string;
  gcs_credentials_json_set: boolean;
  gcs_endpoint?: string;

  // Metadata
  created_at: string;
  updated_at: string;
}

export interface StorageConfigInput {
  backend_type: StorageBackendType;

  // Local storage settings
  local_base_path?: string;
  local_serve_directly?: boolean;

  // Azure Blob Storage settings
  azure_account_name?: string;
  azure_account_key?: string;
  azure_container_name?: string;
  azure_cdn_url?: string;

  // S3 settings
  s3_endpoint?: string;
  s3_region?: string;
  s3_bucket?: string;
  s3_auth_method?: string;
  s3_access_key_id?: string;
  s3_secret_access_key?: string;
  s3_role_arn?: string;
  s3_role_session_name?: string;
  s3_external_id?: string;
  s3_web_identity_token_file?: string;

  // GCS settings
  gcs_bucket?: string;
  gcs_project_id?: string;
  gcs_auth_method?: string;
  gcs_credentials_file?: string;
  gcs_credentials_json?: string;
  gcs_endpoint?: string;
}

export interface SetupStatus {
  storage_configured: boolean;
  setup_required: boolean;
  storage_configured_at?: string;
}
