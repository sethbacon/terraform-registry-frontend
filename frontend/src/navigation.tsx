import Home from '@mui/icons-material/Home'
import ViewModule from '@mui/icons-material/ViewModule'
import Extension from '@mui/icons-material/Extension'
import GetApp from '@mui/icons-material/GetApp'
import Description from '@mui/icons-material/Description'
import Dashboard from '@mui/icons-material/Dashboard'
import Palette from '@mui/icons-material/Palette'
import Business from '@mui/icons-material/Business'
import Badge from '@mui/icons-material/Badge'
import People from '@mui/icons-material/People'
import ManageAccounts from '@mui/icons-material/ManageAccounts'
import SyncAlt from '@mui/icons-material/SyncAlt'
import VerifiedUser from '@mui/icons-material/VerifiedUser'
import Key from '@mui/icons-material/Key'
import GitHub from '@mui/icons-material/GitHub'
import CloudDownload from '@mui/icons-material/CloudDownload'
import HourglassEmpty from '@mui/icons-material/HourglassEmpty'
import Policy from '@mui/icons-material/Policy'
import Storage from '@mui/icons-material/Storage'
import Security from '@mui/icons-material/Security'
import History from '@mui/icons-material/History'
import Notifications from '@mui/icons-material/Notifications'
import type { NavItem, NavGroup } from '@sethbacon/terraform-suite-ui'

// Home — shown standalone at the top of the drawer.
export const homeItem: NavItem = {
  path: '/',
  labelKey: 'nav.home',
  tooltipKey: 'nav.homeTooltip',
  icon: <Home />,
  scope: null,
}

// Public catalogue items, shown flat under Home (always visible).
export const primaryNavItems: NavItem[] = [
  { path: '/modules', labelKey: 'nav.modules', tooltipKey: 'nav.modulesTooltip', icon: <ViewModule />, scope: null },
  { path: '/providers', labelKey: 'nav.providers', tooltipKey: 'nav.providersTooltip', icon: <Extension />, scope: null },
  {
    path: '/terraform-binaries',
    labelKey: 'nav.terraformBinaries',
    tooltipKey: 'nav.terraformBinariesTooltip',
    icon: <GetApp />,
    scope: null,
  },
  { path: '/api-docs', labelKey: 'nav.apiDocs', tooltipKey: 'nav.apiDocsTooltip', icon: <Description />, scope: null },
]

// Dev-only Component Showcase — appended to the flat nav in dev builds.
export const componentShowcaseItem: NavItem = {
  path: '/dev/components',
  labelKey: 'nav.admin.componentsDev',
  tooltipKey: 'nav.admin.componentsDevTooltip',
  icon: <Palette />,
  scope: null,
}

// Admin Dashboard — rendered standalone above the first admin group.
export const adminDashboardItem: NavItem = {
  path: '/admin',
  labelKey: 'nav.admin.dashboard',
  tooltipKey: 'nav.admin.dashboardTooltip',
  icon: <Dashboard />,
  scope: null,
}

// Collapsible, scope-filtered admin groups. The Identity group carries the
// standalone Dashboard link above its header (registry sidebar layout).
export const adminNavGroups: NavGroup[] = [
  {
    key: 'identity',
    labelKey: 'nav.admin.identity',
    standaloneItem: adminDashboardItem,
    items: [
      { path: '/admin/organizations', labelKey: 'nav.admin.organizations', tooltipKey: 'nav.admin.organizationsTooltip', icon: <Business />, scope: 'organizations:read' },
      { path: '/admin/roles', labelKey: 'nav.admin.roles', tooltipKey: 'nav.admin.rolesTooltip', icon: <Badge />, scope: 'users:read' },
      { path: '/admin/users', labelKey: 'nav.admin.users', tooltipKey: 'nav.admin.usersTooltip', icon: <People />, scope: 'users:read' },
      { path: '/admin/oidc', labelKey: 'nav.admin.oidcGroups', tooltipKey: 'nav.admin.oidcGroupsTooltip', icon: <ManageAccounts />, scope: 'admin' },
      { path: '/admin/scim', labelKey: 'nav.admin.scim', tooltipKey: 'nav.admin.scimTooltip', icon: <SyncAlt />, scope: 'admin' },
      { path: '/admin/mtls', labelKey: 'nav.admin.mtlsCerts', tooltipKey: 'nav.admin.mtlsCertsTooltip', icon: <VerifiedUser />, scope: 'admin' },
      { path: '/admin/apikeys', labelKey: 'nav.admin.apiKeys', tooltipKey: 'nav.admin.apiKeysTooltip', icon: <Key />, scope: null },
    ],
  },
  {
    key: 'source-control',
    labelKey: 'nav.admin.sourceControl',
    items: [
      { path: '/admin/scm-providers', labelKey: 'nav.admin.sourceControl', tooltipKey: 'nav.admin.sourceControlTooltip', icon: <GitHub />, scope: 'scm:read' },
    ],
  },
  {
    key: 'mirroring',
    labelKey: 'nav.admin.mirroring',
    items: [
      { path: '/admin/mirrors', labelKey: 'nav.admin.providerConfig', tooltipKey: 'nav.admin.providerConfigTooltip', icon: <CloudDownload />, scope: 'mirrors:read' },
      { path: '/admin/terraform-mirror', labelKey: 'nav.admin.binariesConfig', tooltipKey: 'nav.admin.binariesConfigTooltip', icon: <GetApp />, scope: 'mirrors:read' },
      { path: '/admin/approvals', labelKey: 'nav.admin.approvals', tooltipKey: 'nav.admin.approvalsTooltip', icon: <HourglassEmpty />, scope: 'mirrors:read' },
      { path: '/admin/version-approvals', labelKey: 'nav.admin.versionApprovals', tooltipKey: 'nav.admin.versionApprovalsTooltip', icon: <HourglassEmpty />, scope: 'mirrors:read' },
      { path: '/admin/policies', labelKey: 'nav.admin.mirrorPolicies', tooltipKey: 'nav.admin.mirrorPoliciesTooltip', icon: <Policy />, scope: 'admin' },
    ],
  },
  {
    key: 'system',
    labelKey: 'nav.admin.system',
    items: [
      { path: '/admin/storage', labelKey: 'nav.admin.storage', tooltipKey: 'nav.admin.storageTooltip', icon: <Storage />, scope: 'admin' },
      { path: '/admin/security-scanning', labelKey: 'nav.admin.securityScanning', tooltipKey: 'nav.admin.securityScanningTooltip', icon: <Security />, scope: 'admin' },
      { path: '/admin/notifications', labelKey: 'nav.admin.notifications', tooltipKey: 'nav.admin.notificationsTooltip', icon: <Notifications />, scope: 'admin' },
      { path: '/admin/audit-logs', labelKey: 'nav.admin.auditLogs', tooltipKey: 'nav.admin.auditLogsTooltip', icon: <History />, scope: 'audit:read' },
    ],
  },
]
