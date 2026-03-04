// Types for the Terraform binary mirror feature.
// These match the Go model structs in backend/internal/db/models/terraform_mirror.go.
// Multiple named configs are supported so Terraform and OpenTofu can each have their own mirror.

export interface TerraformMirrorConfig {
  id: string;
  /** Human-readable unique identifier used in API paths (e.g. "hashicorp-terraform") */
  name: string;
  description?: string | null;
  /** terraform | opentofu | custom */
  tool: string;
  enabled: boolean;
  upstream_url: string;
  /** JSONB-encoded string of "os/arch" pairs, e.g. '["linux/amd64","darwin/arm64"]'. null = all platforms. */
  platform_filter?: string | null;
  /** Version filter expression: prefix ("1.9."), "latest:N", semver constraint (">=1.5.0"), or comma-separated exact versions. null = all versions. */
  version_filter?: string | null;
  gpg_verify: boolean;
  stable_only: boolean;
  sync_interval_hours: number;
  last_sync_at?: string | null;
  last_sync_status?: string | null;
  last_sync_error?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TerraformVersionPlatform {
  id: string;
  version_id: string;
  os: string;
  arch: string;
  upstream_url: string;
  filename: string;
  sha256: string;
  storage_key?: string | null;
  storage_backend?: string | null;
  sha256_verified: boolean;
  gpg_verified: boolean;
  /** pending | syncing | synced | failed */
  sync_status: string;
  sync_error?: string | null;
  synced_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TerraformVersion {
  id: string;
  config_id: string;
  version: string;
  is_latest: boolean;
  is_deprecated: boolean;
  release_date?: string | null;
  /** pending | syncing | synced | failed | partial */
  sync_status: string;
  sync_error?: string | null;
  synced_at?: string | null;
  created_at: string;
  updated_at: string;
  platforms?: TerraformVersionPlatform[];
}

export interface TerraformSyncHistory {
  id: string;
  config_id: string;
  triggered_by: string;
  started_at: string;
  completed_at?: string | null;
  /** running | success | failed | cancelled */
  status: string;
  versions_synced: number;
  platforms_synced: number;
  versions_failed: number;
  error_message?: string | null;
  sync_details?: string | null;
}

// ---- Response types ----

export interface TerraformMirrorConfigListResponse {
  configs: TerraformMirrorConfig[];
  total_count: number;
}

export interface TerraformMirrorStatusResponse {
  config: TerraformMirrorConfig;
  version_count: number;
  platform_count: number;
  pending_count: number;
  latest_version?: string | null;
}

export interface TerraformVersionListResponse {
  versions: TerraformVersion[];
  total_count: number;
}

export interface TerraformSyncHistoryListResponse {
  history: TerraformSyncHistory[];
  total_count: number;
}

export interface TerraformBinaryDownloadResponse {
  os: string;
  arch: string;
  version: string;
  filename: string;
  sha256: string;
  download_url: string;
}

// ---- Request types ----

export interface CreateTerraformMirrorConfigRequest {
  name: string;
  description?: string;
  /** terraform | opentofu | custom */
  tool: string;
  upstream_url: string;
  /** Empty array / omit means all platforms; non-empty means filter to these "os/arch" strings. */
  platform_filter?: string[];
  /** Version filter: prefix ("1.9."), "latest:N", semver (">=1.5.0"), comma-separated exact, or single version. Omit for all versions. */
  version_filter?: string;
  gpg_verify?: boolean;
  stable_only?: boolean;
  enabled?: boolean;
  sync_interval_hours?: number;
}

export interface UpdateTerraformMirrorConfigRequest {
  name?: string;
  description?: string;
  tool?: string;
  enabled?: boolean;
  upstream_url?: string;
  /** Empty array means "all platforms"; non-empty means filter to these "os/arch" strings. */
  platform_filter?: string[];
  /** Version filter: prefix ("1.9."), "latest:N", semver (">=1.5.0"), comma-separated exact, or single version. Empty/omit clears the filter. */
  version_filter?: string;
  gpg_verify?: boolean;
  stable_only?: boolean;
  sync_interval_hours?: number;
}

// ---- UI helpers ----

/** Parse the JSON platform_filter string into a string array. */
export function parsePlatformFilter(raw?: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Colour-maps for sync_status chips. */
export type SyncStatusColor = 'success' | 'warning' | 'error' | 'default' | 'info';

export function syncStatusColor(status: string): SyncStatusColor {
  switch (status) {
    case 'synced':
    case 'success':
      return 'success';
    case 'syncing':
    case 'in_progress':
      return 'info';
    case 'pending':
      return 'warning';
    case 'failed':
      return 'error';
    case 'partial':
      return 'warning';
    default:
      return 'default';
  }
}
