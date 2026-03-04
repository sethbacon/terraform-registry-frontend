// RBAC Types for Role Templates, Approval Workflows, and Mirror Policies

export interface RoleTemplate {
  id: string;
  name: string;
  display_name: string;
  description?: string;
  scopes: string[];
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface MirrorApprovalRequest {
  id: string;
  mirror_config_id: string;
  organization_id?: string;
  requested_by?: string;
  provider_namespace: string;
  provider_name?: string;
  reason?: string;
  status: ApprovalStatus;
  reviewed_by?: string;
  reviewed_at?: string;
  review_notes?: string;
  auto_approved: boolean;
  created_at: string;
  updated_at: string;
  expires_at?: string;
  // Joined fields
  requested_by_name?: string;
  reviewed_by_name?: string;
  mirror_name?: string;
}

export type PolicyType = 'allow' | 'deny';

export interface MirrorPolicy {
  id: string;
  organization_id?: string;
  name: string;
  description?: string;
  policy_type: PolicyType;
  upstream_registry?: string;
  namespace_pattern?: string;
  provider_pattern?: string;
  priority: number;
  is_active: boolean;
  requires_approval: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
  // Joined fields
  organization_name?: string;
  created_by_name?: string;
}

export interface PolicyEvaluationResult {
  allowed: boolean;
  requires_approval: boolean;
  matched_policy?: MirrorPolicy;
  reason: string;
}

// Available scopes in the system
export const AVAILABLE_SCOPES = [
  { value: 'modules:read', label: 'Modules Read', description: 'View modules and versions' },
  { value: 'modules:write', label: 'Modules Write', description: 'Upload and manage modules' },
  { value: 'providers:read', label: 'Providers Read', description: 'View providers and versions' },
  { value: 'providers:write', label: 'Providers Write', description: 'Upload and manage providers' },
  { value: 'mirrors:read', label: 'Mirrors Read', description: 'View mirror configurations and status' },
  { value: 'mirrors:manage', label: 'Mirrors Manage', description: 'Create and manage mirror configurations' },
  { value: 'users:read', label: 'Users Read', description: 'View user information' },
  { value: 'users:write', label: 'Users Write', description: 'Manage users' },
  { value: 'organizations:read', label: 'Organizations Read', description: 'View organizations and members' },
  { value: 'organizations:write', label: 'Organizations Write', description: 'Create, update, and manage organizations' },
  { value: 'scm:read', label: 'SCM Read', description: 'View SCM provider configurations' },
  { value: 'scm:manage', label: 'SCM Manage', description: 'Create and manage SCM provider integrations' },
  { value: 'api_keys:manage', label: 'API Keys Manage', description: 'Create and manage API keys' },
  { value: 'audit:read', label: 'Audit Read', description: 'View audit logs' },
  { value: 'admin', label: 'Administrator', description: 'Full access to all features' },
] as const;

export type ScopeValue = typeof AVAILABLE_SCOPES[number]['value'];
