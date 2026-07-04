export type VersionApprovalStatus = 'pending_approval' | 'approved' | 'rejected'
export type VersionApprovalType = 'provider' | 'terraform' | 'scanner'

export interface VersionApproval {
  id: string
  type: VersionApprovalType
  version: string
  approval_status: VersionApprovalStatus
  provider_namespace?: string
  provider_name?: string
  mirror_config_name: string
  mirror_config_id: string
  gpg_verified?: boolean
  shasum_verified?: boolean
  synced_at: string
  tool?: string
}

export interface VersionApprovalEvent {
  id: string
  action: 'auto_approved' | 'approved' | 'rejected'
  performed_by_name?: string
  notes?: string
  auto_approve_rule?: string
  created_at: string
}

export interface VersionApprovalListResponse {
  items: VersionApproval[]
  total: number
}

export interface VersionApprovalBulkResponse {
  approved?: number
  rejected?: number
  failures: string[]
}

export type AutoApproveRuleType =
  | 'patch_only'
  | 'delay_hours'
  | 'gpg_verified'
  | 'semver_constraint'

export interface AutoApproveRule {
  type: AutoApproveRuleType
  hours?: number
  constraint?: string
}

export interface AutoApproveRules {
  rules: AutoApproveRule[]
  mode: 'any' | 'all'
}
