# Roadmap: Version Approval UI

> **Status:** Shipped (2.x line). The feature described below is implemented —
> see `frontend/src/pages/admin/VersionApprovalsPage.tsx`,
> `frontend/src/types/version_approval.ts`, the `listVersionApprovals` /
> `approveVersion` / `getPendingVersionApprovalCount` API methods, the
> `/admin/version-approvals` route, the `admin.versionApprovals` i18n block, and
> `VersionApprovalsPage.test.tsx`. This document is retained as the original
> design record; the future-tense prose below reflects the plan as written, not
> outstanding work.
>
> **Owner:** Registry frontend maintainers · **Last updated:** 2026-06-17

## Summary

Add frontend support for version-level approval of mirrored provider and terraform binary versions. Admins can review pending versions, approve/reject individually or in bulk, configure auto-approve rules, and see pending counts on the dashboard.

## Motivation

The backend will gate newly synced versions behind approval when `requires_approval` is enabled on a mirror config. The frontend needs:
1. A dedicated approval queue page
2. Inline approval actions on existing mirror version lists
3. Configuration UI for approval mode and auto-approve rules
4. Dashboard visibility into pending approval count

## New Page: Version Approvals

**Route:** `/admin/version-approvals`

**Layout:**
- Status tabs: Pending | Approved | Rejected
- Type filter chips: All | Provider Versions | Terraform Versions
- Table columns: Version, Provider/Tool, Mirror Config, Synced At, GPG Status, Actions
- Bulk selection checkboxes with toolbar (Approve Selected / Reject Selected)
- Approve/Reject dialog with optional notes field
- Expandable row showing audit trail (who approved, when, auto-approve rule)

**Pattern:** Follows `ApprovalsPage.tsx` (status tabs, review dialog, status chips).

## Mirror Config Dialog Changes

### MirrorsPage (provider mirrors)
- Add `Switch` labeled "Require version approval" in create/edit dialog
- When enabled, show expandable "Auto-Approve Rules" section:
  - Rule list with add/remove buttons
  - Rule types: Patch Only (toggle), GPG Verified (toggle), Semver Constraint (text field), Delay Hours (number)
  - Mode selector: Any rule matches / All rules must match

### TerraformMirrorPage (terraform binaries)
- Same `Switch` and auto-approve rules section in create/edit dialog

## Version List Enhancements

### MirrorsPage provider tree
- Add approval status `Chip` next to each version:
  - `pending_approval` → orange/warning chip
  - `approved` → green/success chip
  - `rejected` → red/error chip
  - `null` → no chip (not subject to approval)
- Inline "Approve" `IconButton` for pending versions

### TerraformMirrorPage versions dialog
- Same status chip and inline approve button pattern

## Dashboard

- Add "Pending Approvals" stat card or badge to admin dashboard
- Clicking navigates to `/admin/version-approvals?status=pending_approval`
- Uses `getPendingVersionApprovalCount()` API call

## Navigation

- Add "Version Approvals" item to admin sidebar nav
- Badge with pending count (from `pending-count` endpoint)
- Existing "Approvals" renamed to "Mirror Approvals" for disambiguation

## API Service Methods

Add to `frontend/src/services/api.ts`:

```typescript
listVersionApprovals(params?: {
  type?: 'provider' | 'terraform'
  status?: 'pending_approval' | 'approved' | 'rejected'
  config_id?: string
  limit?: number
  offset?: number
}): Promise<{ items: VersionApproval[]; total: number }>

approveVersion(id: string, data?: { notes?: string }): Promise<void>
rejectVersion(id: string, data?: { notes?: string }): Promise<void>
bulkApproveVersions(ids: string[], notes?: string): Promise<{ approved: number; failures: string[] }>
bulkRejectVersions(ids: string[], notes?: string): Promise<{ rejected: number; failures: string[] }>
getVersionApprovalEvents(id: string): Promise<VersionApprovalEvent[]>
getPendingVersionApprovalCount(): Promise<{ count: number }>
```

## Types

New file or extend existing: `frontend/src/types/version_approval.ts`

```typescript
export type VersionApprovalStatus = 'pending_approval' | 'approved' | 'rejected'
export type VersionApprovalType = 'provider' | 'terraform'

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
}

export interface VersionApprovalEvent {
  id: string
  action: 'auto_approved' | 'approved' | 'rejected'
  performed_by_name?: string
  notes?: string
  auto_approve_rule?: string
  created_at: string
}

export interface AutoApproveRule {
  type: 'patch_only' | 'delay_hours' | 'gpg_verified' | 'semver_constraint'
  hours?: number
  constraint?: string
}

export interface AutoApproveRules {
  rules: AutoApproveRule[]
  mode: 'any' | 'all'
}
```

## Tests

### New: `frontend/src/pages/admin/__tests__/VersionApprovalsPage.test.tsx`

| Test                                               | Assertion                         |
| -------------------------------------------------- | --------------------------------- |
| shows loading spinner while fetching               | CircularProgress visible          |
| renders page title and subtitle                    | Heading text present              |
| renders pending versions in table                  | Table rows match mock data        |
| displays approval status chips with correct colors | Chip variant/color mapping        |
| filters by status tab                              | API called with status param      |
| filters by type                                    | API called with type param        |
| shows approve/reject buttons for pending           | Buttons visible on pending rows   |
| opens approve dialog with notes field              | Dialog renders on click           |
| calls approveVersion API on confirm                | Mock called with correct id/notes |
| calls rejectVersion API on confirm                 | Mock called with correct id/notes |
| shows error alert on API failure                   | Alert visible after rejection     |
| supports bulk selection via checkboxes             | Checkboxes toggle state           |
| enables bulk buttons when items selected           | Disabled → enabled transition     |
| calls bulkApproveVersions with selected IDs        | Mock called with id array         |
| shows empty state when no pending                  | Empty message visible             |
| displays GPG/shasum verified icons                 | Icons rendered for verified=true  |
| shows mirror config name                           | Config name in each row           |
| renders provider namespace/name                    | Provider info for provider type   |
| renders tool name for terraform type               | Tool name for terraform type      |

### Extend existing tests

**MirrorsPage.test.tsx:**
- `shows requires_approval switch in create dialog`
- `shows auto-approve rules section when enabled`
- `displays approval status chip on version rows`
- `shows inline approve button for pending versions`

**TerraformMirrorPage.test.tsx:**
- `shows requires_approval switch in create dialog`
- `displays approval status chip in versions dialog`
- `shows inline approve button for pending versions`

**DashboardPage.test.tsx:**
- `displays pending version approvals count`
- `navigates to version approvals on click`

## i18n Keys

Add under `admin.versionApprovals` in `frontend/src/locales/en/translation.json`:

```json
{
  "admin": {
    "versionApprovals": {
      "title": "Version Approvals",
      "subtitle": "Review and approve mirrored versions before they become visible to Terraform clients",
      "pending": "Pending",
      "approved": "Approved",
      "rejected": "Rejected",
      "allTypes": "All",
      "providerVersions": "Provider Versions",
      "terraformVersions": "Terraform Versions",
      "approve": "Approve",
      "reject": "Reject",
      "bulkApprove": "Approve Selected",
      "bulkReject": "Reject Selected",
      "notes": "Notes (optional)",
      "confirmApprove": "Approve this version? It will become visible to Terraform clients.",
      "confirmReject": "Reject this version? It will remain hidden from Terraform clients.",
      "approveSuccess": "Version approved",
      "rejectSuccess": "Version rejected",
      "bulkApproveSuccess": "{{count}} versions approved",
      "bulkRejectSuccess": "{{count}} versions rejected",
      "noVersions": "No versions matching this filter",
      "autoApproved": "Auto-approved",
      "autoApproveRule": "Rule: {{rule}}",
      "requiresApproval": "Require version approval",
      "requiresApprovalHint": "New synced versions must be approved before becoming visible",
      "autoApproveRules": "Auto-Approve Rules",
      "ruleMode": "Rule mode",
      "ruleModeAny": "Any rule matches",
      "ruleModeAll": "All rules must match",
      "rulePatchOnly": "Patch versions only",
      "ruleGpgVerified": "GPG signature verified",
      "ruleSemverConstraint": "Semver constraint",
      "ruleDelayHours": "Delay (hours)",
      "pendingCount": "{{count}} pending"
    }
  }
}
```

## Documentation

- Update `ARCHITECTURE.md` — add `/admin/version-approvals` to admin routes
- Update `TESTING.md` — add `VersionApprovalsPage.test.tsx` to inventory

## Implementation Order

1. Types (`version_approval.ts`)
2. API service methods
3. Query keys
4. `VersionApprovalsPage.tsx` + tests
5. Mirror config dialog changes (MirrorsPage + TerraformMirrorPage) + extend tests
6. Version list chips + inline approve buttons
7. Dashboard badge + extend tests
8. Navigation update
9. i18n keys + DeepL fan-out
