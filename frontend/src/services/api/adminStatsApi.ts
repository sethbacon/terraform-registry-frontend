import { http } from './http'
import type { OrgQuota } from '../../types'

/**
 * One entry in the admin dashboard's recent mirror sync activity feed
 * (swagger: admin.RecentSyncEntry).
 */
export interface DashboardRecentSync {
  mirror_name: string
  mirror_type: 'binary' | 'provider'
  status: string
  started_at: string
  completed_at?: string | null
  versions_synced: number
  platforms_synced: number
  triggered_by: string
}

/**
 * Aggregate statistics for the admin dashboard (swagger: admin.DashboardStats).
 * Every top-level section is optional: older backend builds may omit newer
 * sections, so consumers (DashboardPage) default each one before rendering.
 */
export interface DashboardStats {
  modules?: {
    total: number
    versions: number
    downloads: number
    by_system: { system: string; count: number }[]
  }
  providers?: {
    total: number
    manual: number
    mirrored: number
    total_versions: number
    manual_versions: number
    mirrored_versions: number
    downloads: number
  }
  users?: number
  organizations?: number
  downloads?: number
  scm_providers?: number
  binary_mirrors?: {
    total: number
    healthy: number
    failed: number
    syncing: number
    platforms: number
    downloads: number
    by_tool: { tool: string; platforms: number }[]
  }
  provider_mirrors?: { total: number; healthy: number; failed: number }
  scanning?: {
    enabled: boolean
    total: number
    pending: number
    clean: number
    findings: number
    error: number
  }
  recent_syncs?: DashboardRecentSync[]
}

// Dashboard Stats
export async function getDashboardStats(): Promise<DashboardStats> {
  const response = await http.get<DashboardStats>('/api/v1/admin/stats/dashboard')
  return response.data
}

// Org Quotas
export async function getOrgQuotas(orgId?: string): Promise<OrgQuota[]> {
  const params = orgId ? { organization_id: orgId } : {}
  const response = await http.get<{ quotas?: OrgQuota[] }>('/api/v1/admin/quotas', { params })
  return response.data.quotas ?? []
}
