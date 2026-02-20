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
    'Interactive API documentation for all registry endpoints, powered by ReDoc. Browse endpoint groups, view request/response schemas, and use the "Try it out" feature to test calls directly.',
  actions: [
    { heading: 'Authenticate', text: 'Paste your API key as a Bearer token using the Authorize button at the top.' },
    { heading: 'Browse Endpoints', text: 'Use the left-hand endpoint tree to navigate by resource group.' },
    { heading: 'Full Swagger UI', text: 'For interactive "Try it out" testing, visit /api-docs/ (trailing slash) for the Swagger UI view.' },
  ],
};

const DASHBOARD_HELP: HelpContent = {
  title: 'Dashboard',
  overview:
    'The admin dashboard shows aggregate counts for modules, providers, users, and recent activity. Use it to get a quick health overview of the registry.',
  actions: [
    { heading: 'View Recent Activity', text: 'The activity feed shows recent uploads, user logins, and configuration changes.' },
    { heading: 'Quick Navigation', text: 'Use the stat cards as shortcuts to the relevant admin section.' },
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

  switch (pathname) {
    case '/':               return HOME_HELP;
    case '/modules':        return MODULES_HELP;
    case '/providers':      return PROVIDERS_HELP;
    case '/api-docs':       return API_DOCS_HELP;
    case '/admin':          return DASHBOARD_HELP;
    case '/admin/users':    return USERS_HELP;
    case '/admin/organizations': return ORGANIZATIONS_HELP;
    case '/admin/roles':    return ROLES_HELP;
    case '/admin/apikeys':  return APIKEYS_HELP;
    case '/admin/upload':   return UPLOAD_HELP;
    case '/admin/scm-providers': return SCM_PROVIDERS_HELP;
    case '/admin/mirrors':  return MIRRORS_HELP;
    case '/admin/storage':  return STORAGE_HELP;
    default:                return DEFAULT_HELP;
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
