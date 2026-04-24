import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Divider,
  List,
  ListItem,
  Link as MuiLink,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import Close from '@mui/icons-material/Close';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { useHelp } from '../contexts/HelpContext';

export const HELP_PANEL_WIDTH = 320;

interface HelpContent {
  title: string;
  overview: string;
  actions: { heading: string; text: string }[];
}

const HOME_HELP: HelpContent = {
  title: 'Home',
  overview:
    'The home page provides a quick-start overview of the registry, including live status of available modules, providers, and mirrors. Use it as a jumping-off point to browse published content or access the admin area.',
  actions: [
    { heading: 'Browse Modules', text: 'Click "Modules" in the sidebar to search and explore published Terraform modules.' },
    { heading: 'Browse Providers', text: 'Click "Providers" to find provider binaries available in this registry.' },
    { heading: 'Admin Access', text: 'If you have admin privileges, use the sidebar links to manage users, upload content, or configure storage.' },
  ],
};

const MODULES_HELP: HelpContent = {
  title: 'Modules',
  overview:
    'Lists all Terraform modules published in this registry. Modules are searchable by name and filterable by namespace. Click any module card to view versions, documentation, and usage instructions.',
  actions: [
    { heading: 'Search', text: 'Use the search field to filter modules by name or namespace in real time.' },
    { heading: 'View Module', text: 'Click a module card to open the detail page with version history and README.' },
    { heading: 'Upload a Module', text: 'Go to Admin → Upload to publish a new module archive.' },
  ],
};

const MODULE_DETAIL_HELP: HelpContent = {
  title: 'Module Detail',
  overview:
    'Shows all published versions of a specific module, its README documentation, and the Terraform source block needed to reference it. The latest stable version is highlighted.',
  actions: [
    { heading: 'Copy Source Block', text: 'Use the copy button next to the source field to get the Terraform module block.' },
    { heading: 'Select Version', text: 'Use the version selector to view documentation and inputs/outputs for a specific version.' },
    { heading: 'Deprecate / Delete', text: 'Admins can deprecate or remove a version using the action buttons on each version row.' },
  ],
};

const PROVIDERS_HELP: HelpContent = {
  title: 'Providers',
  overview:
    'Lists all Terraform providers published or mirrored in this registry. Providers are searchable by type and namespace. Click a provider card to view versions and platform binaries.',
  actions: [
    { heading: 'Search', text: 'Filter providers by name or namespace using the search field.' },
    { heading: 'View Provider', text: 'Click a card to open the provider detail page showing versions and platform downloads.' },
    { heading: 'Upload a Provider', text: 'Go to Admin → Upload to publish a new provider binary with its checksums.' },
  ],
};

const PROVIDER_DETAIL_HELP: HelpContent = {
  title: 'Provider Detail',
  overview:
    'Shows all published versions of a specific provider and the platform binaries available for each version. Includes the Terraform required_providers block for easy copy-paste.',
  actions: [
    { heading: 'Copy Required Providers Block', text: 'Use the copy button to get the required_providers configuration.' },
    { heading: 'Select Version', text: 'Browse platform binaries (OS/arch combinations) per version.' },
    { heading: 'Deprecate / Delete', text: 'Admins can deprecate or remove individual provider versions.' },
  ],
};

const API_DOCS_HELP: HelpContent = {
  title: 'API Reference',
  overview:
    'API documentation for all registry endpoints, powered by ReDoc. Browse endpoint groups and view request/response schemas.',
  actions: [
    { heading: 'Authenticate', text: 'Paste your API key as a Bearer token using the Authorize button at the top.' },
    { heading: 'Browse Endpoints', text: 'Use the left-hand endpoint tree to navigate by resource group.' },
  ],
};

const DASHBOARD_HELP: HelpContent = {
  title: 'Dashboard',
  overview:
    'A live health snapshot of your registry. The top bar shows mirror health at a glance. The stat cards below break down modules (with per-system counts), providers (manual vs mirrored), Terraform binary mirrors, and total downloads.',
  actions: [
    { heading: 'Health Bar', text: 'Binary Mirrors, Provider Mirrors, and Storage pills turn red when something is failing. Click any pill to jump to that section.' },
    { heading: 'Stat Cards', text: 'Each card is a shortcut — click to navigate. The aside panels on Modules and Providers show the breakdown by system or mirror type.' },
    { heading: 'Recent Sync Activity', text: 'The table shows the last 8 sync events across binary and provider mirrors, with status, versions synced, and elapsed time.' },
    { heading: 'Quick Links', text: 'Common admin actions — upload, manage users, configure mirrors — are one click away from the Quick Links panel.' },
  ],
};

const USERS_HELP: HelpContent = {
  title: 'Users',
  overview:
    'Manage registry user accounts. Users can be created manually for local/API-key auth, or created automatically on first OIDC login. Assign users to organizations and grant them role templates here.',
  actions: [
    { heading: 'Create User', text: 'Click "Add User" to create a new account with an email and display name.' },
    { heading: 'Edit User', text: 'Click the edit icon on any row to update the user\'s name, organization, or role.' },
    { heading: 'Delete User', text: 'Removes the user account. Any API keys they hold will also be invalidated.' },
  ],
};

const ORGANIZATIONS_HELP: HelpContent = {
  title: 'Organizations',
  overview:
    'Organizations are namespace containers — modules and providers are published under an organization\'s namespace. Members of an organization inherit its role template\'s permissions.',
  actions: [
    { heading: 'Create Organization', text: 'Click "Add Organization" to define a new namespace with a URL-safe name.' },
    { heading: 'Manage Members', text: 'Expand an organization row to view and modify its member list.' },
    { heading: 'Delete Organization', text: 'Only possible when the organization has no published content.' },
  ],
};

const ROLES_HELP: HelpContent = {
  title: 'Roles & Permissions',
  overview:
    'This page shows the fixed role templates available in the registry. Role templates define the permission scopes granted to users within an organization. Templates are system-defined and read-only.',
  actions: [
    { heading: 'View Scopes', text: 'Expand a role template to see the full list of permission scopes it grants.' },
    { heading: 'Assign to User', text: 'Go to Admin → Users to assign a role template to a user\'s organization membership.' },
  ],
};

const OIDC_GROUPS_HELP: HelpContent = {
  title: 'OIDC Groups',
  overview:
    'Maps identity provider group claims to registry organizations and roles. When a user logs in via OIDC, their group memberships are read from the ID token and used to automatically provision or update their organization membership. Changes take effect on the next login without requiring a server restart.',
  actions: [
    { heading: 'Group Claim Name', text: 'Set this to the claim key in your OIDC ID token that carries the user\'s group list (e.g. "groups"). This must match the protocol mapper configured in your identity provider.' },
    { heading: 'Default Role', text: 'Optionally assign a fallback role to users whose groups do not match any mapping. Leave blank to grant no automatic membership to unmatched users.' },
    { heading: 'Add a Mapping', text: 'Click "Add Mapping" to link an IdP group name to a registry organization and role template. The group name must exactly match the value as it appears in the ID token claim.' },
    { heading: 'Role Templates', text: 'Roles correspond to system role templates (viewer, publisher, mirror_manager, admin). Go to Admin → Roles to review what each template permits.' },
    { heading: 'Save Changes', text: 'Click "Save Changes" to persist your group claim and mapping configuration. Existing sessions are not affected until the user logs in again.' },
  ],
};

const APIKEYS_HELP: HelpContent = {
  title: 'API Keys',
  overview:
    'API keys allow programmatic access to authenticated registry endpoints. Each key is shown once at creation and stored only as a bcrypt hash — it cannot be retrieved after creation.',
  actions: [
    { heading: 'Create Key', text: 'Click "Create API Key" to generate a new key. Copy it immediately — it will not be shown again.' },
    { heading: 'Revoke Key', text: 'Delete a key to immediately invalidate all requests using it.' },
    { heading: 'Use the Key', text: 'Include the key as Authorization: Bearer <key> in HTTP requests.' },
  ],
};

const UPLOAD_HELP: HelpContent = {
  title: 'Upload',
  overview:
    'Upload module archives (.tar.gz) or provider binaries to publish them in the registry. The upload wizard validates archive structure, checksums, and GPG signatures before publishing.',
  actions: [
    { heading: 'Upload Module', text: 'Select the "Module" tab, provide namespace/name/system/version, and attach the .tar.gz archive.' },
    { heading: 'Upload Provider', text: 'Select the "Provider" tab, fill in namespace/type/version/platform details, and attach the binary plus checksum files.' },
    { heading: 'SCM Linking', text: 'Alternatively, link a module to an SCM repository so it publishes automatically from git tags.' },
  ],
};

const SCM_PROVIDERS_HELP: HelpContent = {
  title: 'SCM Providers',
  overview:
    'SCM provider configurations connect the registry to GitHub, GitLab, Bitbucket, or Azure DevOps for automated module publishing via git tag webhooks. Each connection uses OAuth credentials.',
  actions: [
    { heading: 'Add Provider', text: 'Click "Add SCM Provider", select the platform, enter the OAuth App Client ID and Secret, then complete the OAuth authorization flow.' },
    { heading: 'Reconnect', text: 'If OAuth tokens expire, use the reconnect button to re-authorize.' },
    { heading: 'Link a Module', text: 'After adding an SCM provider, go to Admin → Upload → SCM to link a repository to a module.' },
  ],
};

const MIRRORS_HELP: HelpContent = {
  title: 'Provider Mirrors',
  overview:
    'Provider mirrors synchronize provider binaries from the official Terraform registry (or any compatible upstream) into this registry. Once mirrored, providers are available without internet access.',
  actions: [
    { heading: 'Create Mirror', text: 'Click "Add Mirror" to define an upstream registry URL and filter rules for which providers to sync.' },
    { heading: 'Trigger Sync', text: 'Use the sync button on a mirror to immediately fetch the latest versions from upstream.' },
    { heading: 'View Sync History', text: 'Expand a mirror row to see the log of recent sync runs and any errors.' },
  ],
};

const STORAGE_HELP: HelpContent = {
  title: 'Storage',
  overview:
    'Configures the backend storage used for module and provider artifacts. Supported backends are local filesystem, AWS S3, Azure Blob Storage, and Google Cloud Storage. Only one backend can be active at a time.',
  actions: [
    { heading: 'Switch Backend', text: 'Select a backend type, fill in credentials, and click "Activate" to migrate to the new storage.' },
    { heading: 'Test Connection', text: 'Use the "Test" button to validate credentials before activating.' },
    { heading: 'Local Storage', text: 'For development, the local filesystem backend requires no credentials.' },
  ],
};

const TERRAFORM_BINARIES_HELP: HelpContent = {
  title: 'Terraform Binary Mirrors',
  overview:
    'Lists the available Terraform and OpenTofu binary mirrors hosted by this registry. Each mirror caches a set of binary versions from an upstream source so your CI pipelines and developer machines can download them without direct internet access.',
  actions: [
    { heading: 'View Versions', text: 'Click a mirror card to open its detail page, which shows all available versions and the platform binaries (OS/arch) synced for each.' },
    { heading: 'Download URL', text: 'The detail page shows the full download URL pattern. Point your Terraform CLI or CI toolchain at this URL instead of the upstream registry.' },
    { heading: 'Admin Configuration', text: 'To add or manage mirror configurations, go to Admin → Terraform Binaries.' },
  ],
};

const TERRAFORM_BINARY_DETAIL_HELP: HelpContent = {
  title: 'Binary Mirror Detail',
  overview:
    'Shows all versions synced for this binary mirror and the platform binaries available for each version. Expand a version row to inspect individual OS/architecture combinations, checksum verification status, and GPG signature status.',
  actions: [
    { heading: 'Expand Platforms', text: 'Click the expand arrow on a version row to see per-platform details including OS, architecture, filename, and whether checksum and GPG verification passed.' },
    { heading: 'Download URL', text: 'Use the URL pattern shown in the info banner to download a specific version and platform: /terraform/binaries/{name}/versions/{version}/{os}/{arch}.' },
    { heading: 'Deprecate a Version', text: 'Admins can click the warning icon to deprecate a version. Deprecated versions remain available for download but will not be re-synced in future sync runs.' },
    { heading: 'Delete a Version', text: 'Admins can permanently remove a version record and its binaries from storage. Consider deprecating instead if you want to retain the files but prevent re-syncing.' },
    { heading: 'Restore a Deprecated Version', text: 'Click the restore icon on a deprecated version to remove the deprecation flag and allow it to be re-synced.' },
  ],
};

const TERRAFORM_MIRROR_HELP: HelpContent = {
  title: 'Terraform Binary Mirror',
  overview:
    'Manages mirror configurations that cache Terraform and OpenTofu binary distributions from upstream sources. Once mirrored, binaries can be served to engineers without direct internet access, enabling air-gapped or bandwidth-constrained environments.',
  actions: [
    { heading: 'Create a Mirror Config', text: 'Click "Add Mirror" to define a new mirror. Give it a name, select the tool type (terraform, opentofu, or custom), and specify the upstream URL to sync from.' },
    { heading: 'Sync Versions', text: 'Expand a mirror config and click the sync button to immediately fetch the latest binary index from upstream. Sync history shows the result of each run.' },
    { heading: 'Inspect Platforms', text: 'Drill into a version to see which OS/architecture combinations have been downloaded and are available locally.' },
    { heading: 'Enable / Disable', text: 'Toggle a mirror config off to pause scheduled syncs without deleting the configuration or cached binaries.' },
    { heading: 'Delete a Config', text: 'Removes the mirror configuration. Previously synced binaries in storage are not automatically removed.' },
  ],
};

const APPROVALS_HELP: HelpContent = {
  title: 'Approval Requests',
  overview:
    'Approval requests are raised when a mirror policy requires human sign-off before a provider namespace or binary is mirrored. An admin must approve or reject each request. Approved requests allow the mirror sync to proceed; rejected requests block it.',
  actions: [
    { heading: 'Review a Request', text: 'Click the "Approve" or "Reject" button on a pending request card to open the review dialog. Add reviewer notes to explain the decision, then confirm.' },
    { heading: 'Create a Request', text: 'Click "Create Request" to manually raise an approval for a provider namespace. Useful for pre-approving content before configuring a mirror policy.' },
    { heading: 'Filter by Status', text: 'Pending, approved, and rejected requests are all shown together. Look at the status chip on each card to distinguish them at a glance.' },
    { heading: 'Mirror Policy Link', text: 'Each request references the mirror config that triggered it. Navigate to Admin → Provider Mirrors to view or edit the associated mirror configuration.' },
  ],
};

const MIRROR_POLICIES_HELP: HelpContent = {
  title: 'Mirror Policies',
  overview:
    'Mirror policies control which providers are allowed or denied from being mirrored, and whether mirroring them requires an approval request. Policies are matched by upstream registry URL, namespace pattern, and provider name pattern. Higher-priority policies take precedence when multiple rules match.',
  actions: [
    { heading: 'Create a Policy', text: 'Click "Create Policy" and fill in the name, type (allow or deny), and pattern fields. Use glob-style wildcards (e.g. hashicorp/* ) in the namespace and provider fields to match multiple providers at once.' },
    { heading: 'Allow vs Deny', text: 'An "allow" policy permits matched providers to be mirrored. A "deny" policy blocks them. Deny policies override allow policies at the same priority level.' },
    { heading: 'Require Approval', text: 'Enable "Requires Approval" on an allow policy to route matched providers through the approval workflow before syncing. Approved requests appear in Admin → Approval Requests.' },
    { heading: 'Priority', text: 'Policies are evaluated in ascending priority order (lower number = higher priority). Set priority carefully when allow and deny rules overlap.' },
    { heading: 'Evaluate a Policy', text: 'Use the "Evaluate" button to test how a specific provider namespace/name would be matched against the current policy set without triggering a real sync.' },
    { heading: 'Enable / Disable', text: 'Toggle a policy off to suspend it temporarily without deleting it. Disabled policies are skipped during evaluation.' },
  ],
};

const AUDIT_LOGS_HELP: HelpContent = {
  title: 'Audit Logs',
  overview:
    'A tamper-evident record of every significant action taken in the registry — uploads, deletes, configuration changes, login events, and mirror syncs. Use it for compliance reviews, incident investigation, or general activity monitoring.',
  actions: [
    { heading: 'Filter by Resource Type', text: 'Use the Resource Type dropdown to narrow results to a specific entity class (e.g. module, provider, user, mirror).' },
    { heading: 'Filter by Action', text: 'Type an action name (e.g. "create", "delete", "login") in the Action field to show only matching events.' },
    { heading: 'Filter by User', text: 'Enter a user email to see all actions performed by that account.' },
    { heading: 'Date Range', text: 'Set Start and End date pickers to restrict results to a specific time window.' },
    { heading: 'View Detail', text: 'Click any row to open a detail panel showing the full log entry, including resource ID, actor, and metadata.' },
    { heading: 'Export', text: 'Use the Export button to download the current filtered result set as CSV or JSON.' },
  ],
};

const SECURITY_SCANNING_HELP: HelpContent = {
  title: 'Security Scanning',
  overview:
    'Displays the current configuration and results of the module vulnerability scanner. The scanner analyses uploaded module archives for known security issues using an external scanning tool configured by the server administrator.',
  actions: [
    { heading: 'View Configuration', text: 'The top section shows whether scanning is enabled, the scanner tool and version, severity threshold, timeout, and worker/interval settings.' },
    { heading: 'Summary Statistics', text: 'Aggregate counts show total scans, pending, clean, findings, and errors at a glance.' },
    { heading: 'Review Scan Results', text: 'The recent scans table lists each module with its scan status and vulnerability counts broken down by severity (critical, high, medium, low).' },
  ],
};

const MTLS_HELP: HelpContent = {
  title: 'mTLS Certificates',
  overview:
    'Shows the current mutual TLS (mTLS) configuration, including whether client certificate authentication is enabled and which certificate subjects are mapped to authorization scopes. All mTLS settings are read-only in the UI — configuration is managed through the server config file.',
  actions: [
    { heading: 'View Status', text: 'The status indicator shows whether mTLS is enabled or disabled, along with the CA certificate file path used to verify client certificates.' },
    { heading: 'Certificate Mappings', text: 'The mappings table lists each certificate subject and the scopes it is authorized to use. Clients presenting a matching certificate receive these scopes automatically.' },
    { heading: 'Configuration Source', text: 'All mTLS settings are sourced from the server configuration file. To modify mappings, update the config file and restart the backend.' },
  ],
};

const SCIM_HELP: HelpContent = {
  title: 'SCIM Provisioning',
  overview:
    'SCIM 2.0 enables automatic user and group provisioning from your identity provider (e.g. Azure AD, Okta). This page shows the SCIM endpoint URLs and authentication requirements needed to configure your IdP.',
  actions: [
    { heading: 'Endpoint URLs', text: 'Copy the SCIM base URL, Users endpoint, and Groups endpoint into your identity provider\'s SCIM configuration.' },
    { heading: 'Authentication', text: 'SCIM requests require a Bearer token with the scim:provision scope. Create one on the API Keys page and paste it into your IdP\'s SCIM token field.' },
    { heading: 'Supported Operations', text: 'Users support full CRUD and soft-delete. Groups are read-only and map to registry organizations. Filtering and pagination are supported.' },
  ],
};

const DEFAULT_HELP: HelpContent = {
  title: 'Help',
  overview: 'Navigate to a page using the sidebar to see context-sensitive help for that section.',
  actions: [
    { heading: 'API Reference', text: 'Visit the API Docs page for a full interactive reference of all registry endpoints.' },
  ],
};

function getHelpContent(pathname: string): HelpContent {
  // Parameterized routes — check before their parent prefix
  const segments = pathname.split('/').filter(Boolean);
  if (segments[0] === 'modules' && segments.length >= 3) return MODULE_DETAIL_HELP;
  if (segments[0] === 'providers' && segments.length >= 2) return PROVIDER_DETAIL_HELP;
  if (segments[0] === 'terraform-binaries' && segments.length >= 2) return TERRAFORM_BINARY_DETAIL_HELP;

  switch (pathname) {
    case '/': return HOME_HELP;
    case '/modules': return MODULES_HELP;
    case '/providers': return PROVIDERS_HELP;
    case '/terraform-binaries': return TERRAFORM_BINARIES_HELP;
    case '/api-docs': return API_DOCS_HELP;
    case '/admin': return DASHBOARD_HELP;
    case '/admin/users': return USERS_HELP;
    case '/admin/organizations': return ORGANIZATIONS_HELP;
    case '/admin/roles': return ROLES_HELP;
    case '/admin/oidc': return OIDC_GROUPS_HELP;
    case '/admin/apikeys': return APIKEYS_HELP;
    case '/admin/upload': return UPLOAD_HELP;
    case '/admin/scm-providers': return SCM_PROVIDERS_HELP;
    case '/admin/mirrors': return MIRRORS_HELP;
    case '/admin/storage': return STORAGE_HELP;
    case '/admin/audit-logs': return AUDIT_LOGS_HELP;
    case '/admin/terraform-mirror': return TERRAFORM_MIRROR_HELP;
    case '/admin/approvals': return APPROVALS_HELP;
    case '/admin/policies': return MIRROR_POLICIES_HELP;
    case '/admin/security-scanning': return SECURITY_SCANNING_HELP;
    case '/admin/mtls': return MTLS_HELP;
    case '/admin/scim': return SCIM_HELP;
    default: return DEFAULT_HELP;
  }
}

const HelpPanel = () => {
  const { helpOpen, closeHelp } = useHelp();
  const { pathname } = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const content = getHelpContent(pathname);

  return (
    <Drawer
      variant={isMobile ? 'temporary' : 'persistent'}
      anchor="right"
      open={helpOpen}
      onClose={closeHelp}
      ModalProps={{ keepMounted: true }}
      sx={{
        '& .MuiDrawer-paper': {
          width: HELP_PANEL_WIDTH,
          boxSizing: 'border-box',
          top: { xs: 0, md: '64px' }, // sit below AppBar on desktop
          height: { xs: '100%', md: 'calc(100% - 64px)' },
        },
      }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.5 }}>
        <Typography variant="subtitle1" fontWeight="bold">
          {content.title}
        </Typography>
        <IconButton size="small" onClick={closeHelp} aria-label="Close help panel">
          <Close fontSize="small" />
        </IconButton>
      </Box>

      <Divider />

      {/* Body */}
      <Box sx={{ px: 2, py: 2, overflowY: 'auto', flexGrow: 1 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {content.overview}
        </Typography>

        <Typography variant="overline" color="text.secondary">
          What you can do
        </Typography>

        <List disablePadding sx={{ mt: 0.5 }}>
          {content.actions.map((action) => (
            <ListItem key={action.heading} disablePadding sx={{ display: 'block', mb: 1.5 }}>
              <Typography variant="body2" fontWeight="bold">
                {action.heading}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {action.text}
              </Typography>
            </ListItem>
          ))}
        </List>
      </Box>

      <Divider />

      {/* Footer */}
      <Box sx={{ px: 2, py: 1.5 }}>
        <Typography variant="caption" color="text.secondary">
          Full API reference:{' '}
          <MuiLink component={RouterLink} to="/api-docs" onClick={isMobile ? closeHelp : undefined}>
            API Docs
          </MuiLink>
        </Typography>
      </Box>
    </Drawer>
  );
};

export default HelpPanel;
