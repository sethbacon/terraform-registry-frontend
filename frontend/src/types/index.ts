export interface User {
  id: string
  email: string
  name: string
  username?: string // Alias for name for UI purposes
  role?: string // Deprecated: use memberships for per-org roles
  organization_name?: string // Associated organization
  oidc_sub?: string
  created_at: string
  updated_at: string
}

export type { RoleTemplate } from './rbac'

export interface RoleTemplateInfo {
  id?: string
  name: string
  display_name: string
  scopes?: string[]
}

export interface Organization {
  id: string
  name: string
  display_name: string
  idp_type?: string | null // "oidc", "saml", "ldap", or null
  idp_name?: string | null // IdP name within the type
  created_at: string
  updated_at: string
}

export interface OrganizationMember {
  organization_id: string
  user_id: string
  role_template_id?: string
  created_at: string
}

export interface OrganizationMemberWithUser {
  organization_id: string
  user_id: string
  role_template_id?: string
  role_template_name?: string
  role_template_display_name?: string
  role_template_scopes?: string[]
  created_at: string
  user_name: string
  user_email: string
}

export interface UserMembership {
  organization_id: string
  organization_name: string
  role_template_id?: string
  role_template_name?: string
  role_template_display_name?: string
  role_template_scopes?: string[]
  role_template?: RoleTemplateInfo
  created_at: string
}

export interface APIKey {
  id: string
  user_id?: string
  user_name?: string // User name who created this key (joined from users table)
  organization_id: string
  name: string
  description?: string
  key_prefix: string
  scopes: string[]
  expires_at?: string
  last_used_at?: string
  created_at: string
}

export interface RotateAPIKeyResponse {
  new_key: {
    id: string
    name: string
    key: string
    key_prefix: string
    scopes: string[]
    expires_at?: string
    created_at: string
  }
  old_key_status: string
  old_expires_at?: string
}

export interface Module {
  id: string
  namespace: string
  name: string
  system: string
  provider?: string // Alias for system for backward compatibility
  description?: string
  source?: string
  organization_id?: string
  organization_name?: string
  latest_version?: string // Latest version string
  download_count?: number // Total downloads
  versions?: ModuleVersion[] // Embedded versions from getModule API
  created_by?: string // User ID who created this module
  created_by_name?: string // User name who created this module
  created_at: string
  updated_at: string
  deprecated?: boolean
  deprecated_at?: string
  deprecation_message?: string
  successor_module_id?: string
  successor_module?: { namespace: string; name: string; system: string }
}

export interface ModuleVersion {
  id: string
  module_id: string
  version: string
  storage_path?: string
  storage_backend?: string
  size_bytes?: number
  checksum?: string
  readme?: string
  download_count: number
  deprecated?: boolean
  deprecated_at?: string
  deprecation_message?: string
  replacement_source?: string
  deprecation?: { reason?: string; link?: string }
  published_by?: string // User ID who published this version
  published_by_name?: string // User name who published this version
  published_at?: string
  created_at?: string
}

export interface Provider {
  id: string
  namespace: string
  type: string
  description?: string
  source?: string
  organization_id: string
  organization_name?: string
  latest_version?: string // Latest version string
  download_count?: number // Total downloads
  created_by?: string // User ID who created this provider
  created_by_name?: string // User name who created this provider
  created_at: string
  updated_at: string
}

export interface ProviderPlatform {
  id: string
  provider_version_id: string
  os: string
  arch: string
  filename: string
  storage_path: string
  storage_backend: string
  size_bytes: number
  shasum: string
  download_count: number
}

export interface ProviderVersion {
  id: string
  provider_id: string
  version: string
  protocols: string[]
  gpg_public_key: string
  shasums_url: string
  shasums_signature_url: string
  published_by?: string // User ID who published this version
  published_by_name?: string // User name who published this version
  published_at: string
  download_count?: number
  platforms?: ProviderPlatform[]
  deprecated?: boolean
  deprecated_at?: string
  deprecation_message?: string
  created_at: string
}

export interface ProviderDocEntry {
  id: string
  title: string
  slug: string
  category: string
  subcategory?: string
  language: string
}

export interface ProviderDocsResponse {
  docs: ProviderDocEntry[]
  categories: string[]
  total: number
  limit: number
  offset: number
}

export interface ProviderDocContent {
  content: string
  title: string
  category: string
  slug: string
}

export interface PaginationMeta {
  page: number
  per_page: number
  total: number
}

export interface AuthContextType {
  user: User | null
  roleTemplate: RoleTemplateInfo | null // Primary role template (backward compat)
  allowedScopes: string[] // Combined scopes across all org memberships
  memberships?: UserMembership[] // Per-org memberships with role templates
  isAuthenticated: boolean
  isLoading: boolean
  sessionExpiresAt: Date | null
  sessionExpiresSoon: boolean
  login: (userOrProvider: User | 'oidc' | 'azuread') => Promise<void>
  logout: () => void
  refreshToken: () => Promise<void>
  setToken: (token: string) => void // For dev mode impersonation
}

// Storage Configuration Types
export type StorageBackendType = 'local' | 'azure' | 's3' | 'gcs'

export interface StorageConfigResponse {
  id: string
  backend_type: StorageBackendType
  is_active: boolean

  // Local storage settings
  local_base_path?: string
  local_serve_directly?: boolean

  // Azure Blob Storage settings
  azure_account_name?: string
  azure_account_key_set: boolean
  azure_container_name?: string
  azure_cdn_url?: string

  // S3 settings
  s3_endpoint?: string
  s3_region?: string
  s3_bucket?: string
  s3_auth_method?: string
  s3_access_key_id_set: boolean
  s3_secret_access_key_set: boolean
  s3_role_arn?: string
  s3_role_session_name?: string
  s3_external_id?: string
  s3_web_identity_token_file?: string

  // GCS settings
  gcs_bucket?: string
  gcs_project_id?: string
  gcs_auth_method?: string
  gcs_credentials_file?: string
  gcs_credentials_json_set: boolean
  gcs_endpoint?: string

  // Metadata
  created_at: string
  updated_at: string
}

export interface StorageConfigInput {
  backend_type: StorageBackendType

  // Local storage settings
  local_base_path?: string
  local_serve_directly?: boolean

  // Azure Blob Storage settings
  azure_account_name?: string
  azure_account_key?: string
  azure_container_name?: string
  azure_cdn_url?: string

  // S3 settings
  s3_endpoint?: string
  s3_region?: string
  s3_bucket?: string
  s3_auth_method?: string
  s3_access_key_id?: string
  s3_secret_access_key?: string
  s3_role_arn?: string
  s3_role_session_name?: string
  s3_external_id?: string
  s3_web_identity_token_file?: string

  // GCS settings
  gcs_bucket?: string
  gcs_project_id?: string
  gcs_auth_method?: string
  gcs_credentials_file?: string
  gcs_credentials_json?: string
  gcs_endpoint?: string
}

export interface SetupStatus {
  storage_configured: boolean
  setup_required: boolean
  storage_configured_at?: string
  // Enhanced fields from setup wizard
  setup_completed?: boolean
  oidc_configured?: boolean
  ldap_configured?: boolean
  auth_method?: 'oidc' | 'ldap'
  scanning_configured?: boolean
  admin_configured?: boolean
  pending_feature_setup?: boolean
}

// Setup Wizard — Security Scanning configuration
export interface ScanningConfigInput {
  enabled: boolean
  tool: string
  binary_path?: string
  severity_threshold?: string
  timeout?: string
}

export interface ScanningTestResult {
  success: boolean
  message: string
  tool?: string
  version?: string
}

// Setup Wizard / Admin — Scanner auto-install
export interface ScanningInstallRequest {
  tool: string
  version?: string
}

export interface ScanningInstallResult {
  success: boolean
  tool: string
  version: string
  binary_path: string
  sha256: string
  source_url: string
  error?: string
}

// Setup Wizard — LDAP configuration
export interface LDAPConfigInput {
  host: string
  port: number
  use_tls: boolean
  start_tls: boolean
  insecure_skip_verify: boolean
  bind_dn: string
  bind_password: string
  base_dn: string
  user_filter: string
  user_attr_email: string
  user_attr_name: string
  group_base_dn: string
  group_filter: string
  group_member_attr: string
}

// Setup Wizard Types
export interface OIDCConfigInput {
  name?: string
  provider_type: 'generic_oidc' | 'azuread'
  issuer_url: string
  client_id: string
  client_secret: string
  redirect_url: string
  scopes?: string[]
  extra_config?: Record<string, string>
}

export interface OIDCGroupMapping {
  group: string
  organization: string
  role: string
}

export interface OIDCGroupMappingInput {
  group_claim_name: string
  group_mappings: OIDCGroupMapping[]
  default_role: string
}

export interface OIDCConfigResponse {
  id: string
  name: string
  provider_type: string
  issuer_url: string
  client_id: string
  redirect_url: string
  scopes: string[]
  is_active: boolean
  group_claim_name?: string
  group_mappings?: OIDCGroupMapping[]
  default_role?: string
  created_at: string
  updated_at: string
}

// SAML + LDAP identity group mapping types (read-only from server config)
export interface SAMLGroupMapping {
  group: string
  organization: string
  role: string
}

export interface LDAPGroupMapping {
  group_dn: string
  organization: string
  role: string
}

export interface IdentityGroupMappings {
  saml?: {
    group_attribute_name: string
    default_role: string
    group_mappings: SAMLGroupMapping[]
  }
  ldap?: {
    default_role: string
    group_mappings: LDAPGroupMapping[]
  }
}

export interface MTLSSubjectMapping {
  subject: string
  scopes: string[]
}

export interface MTLSConfigResponse {
  enabled: boolean
  client_ca_file: string
  mappings: MTLSSubjectMapping[]
}

export interface SetupValidateTokenResponse {
  valid: boolean
  message: string
}

export interface SetupTestResult {
  success: boolean
  message: string
  issuer?: string // For OIDC test
}

export interface ConfigureAdminInput {
  email: string
}

export interface ConfigureAdminResponse {
  message: string
  email: string
  organization: string
  role: string
}

export interface CompleteSetupResponse {
  message: string
  setup_completed: boolean
}

export interface AuditLog {
  id: string
  user_id: string | null
  user_email: string | null
  user_name: string | null
  organization_id: string | null
  action: string
  resource_type: string | null
  resource_id: string | null
  metadata: Record<string, unknown> | null
  ip_address: string | null
  created_at: string
}

export interface AuditLogListResponse {
  logs: AuditLog[]
  pagination: PaginationMeta
}

export interface VersionInfo {
  version: string
  build_date: string
  api_version: string
  protocols: {
    modules: string
    providers: string
    mirror: string
  }
  oci?: boolean
}

// ---- Whitelabel / UI theme ----

/**
 * Runtime theme configuration returned by GET /api/v1/ui/theme.
 * All fields are optional; the frontend falls back to built-in defaults when
 * the endpoint is absent or a field is missing.
 */
export interface UIThemeConfig {
  /** Display name for the product, e.g. "Acme Terraform Registry" */
  product_name?: string
  /** Primary brand colour as a hex string, e.g. "#5C4EE5" */
  primary_color?: string
  /** Secondary brand colour as a hex string */
  secondary_color_light?: string
  secondary_color_dark?: string
  /** URL to the logo image shown in the sidebar header and login page */
  logo_url?: string
  /** URL to a custom favicon (overrides the default) */
  favicon_url?: string
  /** URL to the hero background image on the login page */
  login_hero_url?: string
}

// ---- Policy Engine ----

export interface PolicyViolation {
  rule: string
  message: string
}

export interface PolicyResult {
  allowed: boolean
  mode: string
  violations: PolicyViolation[]
}

// ---- Module Security Scan ----

export type ModuleScanStatus = 'pending' | 'scanning' | 'clean' | 'findings' | 'error'

export interface ModuleScan {
  id: string
  module_version_id: string
  scanner: string
  scanner_version: string | null
  expected_version: string | null
  status: ModuleScanStatus
  scanned_at: string | null
  critical_count: number
  high_count: number
  medium_count: number
  low_count: number
  raw_results: Record<string, unknown> | null
  error_message: string | null
  // Scanner stderr/stdout captured during execution. Added in backend #264;
  // optional because older scans predate the column.
  execution_log?: string | null
  created_at: string
  updated_at: string
}

// ---- Module terraform-docs ----

// ---- Security Scanning Admin ----

export interface ScanningConfig {
  enabled: boolean
  tool: string
  expected_version?: string
  severity_threshold: string
  timeout: string
  worker_count: number
  scan_interval_mins: number
  // Added in backend #263 — optional until backend is updated
  binary_path?: string
  detected_version?: string
}

export interface RecentScanEntry {
  id: string
  module_version: string
  module_name: string
  namespace: string
  system: string
  scanner: string
  status: ModuleScanStatus
  critical_count: number
  high_count: number
  medium_count: number
  low_count: number
  scanned_at: string | null
  created_at: string
  // Diagnostic fields — optional; only populated by recent backends (>= #264).
  // Surfaced in the admin Recent Scans table for troubleshooting failed scans.
  error_message?: string | null
  execution_log?: string | null
}

export interface ScanningStats {
  total: number
  pending: number
  scanning: number
  clean: number
  findings: number
  error: number
  recent_scans: RecentScanEntry[]
}

// ---- Scan findings (parsed from raw_results) ----

export interface FindingRow {
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  ruleId: string
  title: string
  resource: string
  file: string
  resolution: string
}

// ---- Module terraform-docs ----

export interface ModuleInputVar {
  name: string
  type: string
  description: string
  default: unknown
  required: boolean
}

export interface ModuleOutputVal {
  name: string
  description: string
  sensitive: boolean
}

export interface ModuleProviderReq {
  name: string
  source: string
  version_constraints: string
}

export interface ModuleRequirements {
  required_version: string
}

export interface ModuleDoc {
  inputs: ModuleInputVar[]
  outputs: ModuleOutputVal[]
  providers: ModuleProviderReq[]
  requirements: ModuleRequirements | null
}

// ---- Org Quota ----

export interface OrgQuota {
  organization_id: string
  storage_bytes_limit: number
  storage_bytes_used: number
  storage_utilization_ratio: number
  publishes_per_day_limit: number
  publishes_today: number
  publish_utilization_ratio: number
  downloads_per_day_limit: number
  downloads_today: number
  download_utilization_ratio: number
}

// ---- Storage Migration ----

export interface MigrationPlan {
  source_config_id: string
  target_config_id: string
  total_artifacts: number
  total_modules: number
  total_providers: number
  estimated_size_bytes: number
}

export interface StorageMigration {
  id: string
  source_config_id: string
  target_config_id: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  total_artifacts: number
  migrated_artifacts: number
  failed_artifacts: number
  error_message?: string
  started_at?: string
  completed_at?: string
  created_at: string
}

// ---- CVE Advisories ----

export type CVESeverity = 'critical' | 'high' | 'medium' | 'low' | 'unknown'
export type CVETargetKind = 'binary' | 'provider' | 'scanner'

export interface CVEAdvisory {
  id: string
  source_id: string
  severity: CVESeverity
  summary: string
  references: string[]
  target_kind: CVETargetKind
  targets: CVEAffectedTarget[]
}

export interface CVEAffectedTarget {
  id: string
  advisory_id: string
  target_kind: CVETargetKind
  target_ref: {
    tool?: string
    version?: string
    namespace?: string
    type?: string
    mirror_config_id?: string
    provider_id?: string
  }
  terraform_version_id?: string
  provider_version_id?: string
  created_at: string
}

// Admin-only full advisory list entry
export interface CVEAdvisoryAdmin {
  id: string
  source_id: string
  severity: CVESeverity
  summary: string
  references: string[]
  withdrawn: boolean
  target_count: number
}
