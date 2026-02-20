// Mirror configuration types

export interface MirrorConfiguration {
  id: string;
  name: string;
  description?: string;
  upstream_registry_url: string;
  organization_id?: string;
  namespace_filter?: string; // JSON array string
  provider_filter?: string; // JSON array string
  version_filter?: string; // Version filter: "3.", "latest:5", ">=3.0.0", or comma-separated
  platform_filter?: string; // JSON array string of "os/arch" (e.g. ["linux/amd64", "windows/amd64"])
  enabled: boolean;
  sync_interval_hours: number;
  last_sync_at?: string;
  last_sync_status?: 'success' | 'failed' | 'in_progress';
  last_sync_error?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface MirrorSyncHistory {
  id: string;
  mirror_config_id: string;
  started_at: string;
  completed_at?: string;
  status: 'running' | 'success' | 'failed' | 'cancelled';
  providers_synced: number;
  providers_failed: number;
  error_message?: string;
  sync_details?: string; // JSON string
}

export interface MirrorSyncStatus {
  mirror_config: MirrorConfiguration;
  current_sync?: MirrorSyncHistory;
  recent_syncs: MirrorSyncHistory[];
  next_scheduled?: string;
}

export interface CreateMirrorConfigRequest {
  name: string;
  description?: string;
  upstream_registry_url: string;
  organization_id?: string;
  namespace_filter?: string[];
  provider_filter?: string[];
  version_filter?: string; // Version filter: "3.", "latest:5", ">=3.0.0", or comma-separated
  platform_filter?: string[]; // List of "os/arch" strings (e.g. ["linux/amd64", "windows/amd64"])
  enabled?: boolean;
  sync_interval_hours?: number;
}

export interface UpdateMirrorConfigRequest {
  name?: string;
  description?: string;
  upstream_registry_url?: string;
  organization_id?: string;
  namespace_filter?: string[];
  provider_filter?: string[];
  version_filter?: string; // Version filter: "3.", "latest:5", ">=3.0.0", or comma-separated
  platform_filter?: string[]; // List of "os/arch" strings (e.g. ["linux/amd64", "windows/amd64"])
  enabled?: boolean;
  sync_interval_hours?: number;
}

export interface TriggerSyncRequest {
  namespace?: string;
  provider_name?: string;
}

// Parsed versions for UI display
export interface ParsedMirrorConfig extends MirrorConfiguration {
  namespaceFilters: string[];
  providerFilters: string[];
  platformFilters: string[];
}

// Helper to parse JSON filter strings
export function parseMirrorConfig(config: MirrorConfiguration): ParsedMirrorConfig {
  let namespaceFilters: string[] = [];
  let providerFilters: string[] = [];
  let platformFilters: string[] = [];

  try {
    if (config.namespace_filter) {
      namespaceFilters = JSON.parse(config.namespace_filter);
    }
  } catch {
    // Ignore parse errors
  }

  try {
    if (config.provider_filter) {
      providerFilters = JSON.parse(config.provider_filter);
    }
  } catch {
    // Ignore parse errors
  }

  try {
    if (config.platform_filter) {
      platformFilters = JSON.parse(config.platform_filter);
    }
  } catch {
    // Ignore parse errors
  }

  return {
    ...config,
    namespaceFilters,
    providerFilters,
    platformFilters,
  };
}
