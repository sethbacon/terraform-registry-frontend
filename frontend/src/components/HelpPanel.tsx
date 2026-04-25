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
import { useTranslation } from 'react-i18next';
// Simplified t-function type — avoids excessively-deep instantiation from the
// large i18next key union when using dynamic (computed) translation keys.
type TStr = (key: string, options?: Record<string, unknown>) => string;
import { useHelp } from '../contexts/HelpContext';

export const HELP_PANEL_WIDTH = 320;

interface HelpContent {
  title: string;
  overview: string;
  actions: { heading: string; text: string }[];
}

// Action key arrays keyed by help section name — order defines display order
const HELP_ACTION_KEYS: Record<string, string[]> = {
  default: ['apiReference'],
  home: ['browseModules', 'browseProviders', 'adminAccess'],
  modules: ['search', 'viewModule', 'uploadModule'],
  moduleDetail: ['copySourceBlock', 'selectVersion', 'deprecateDelete'],
  providers: ['search', 'viewProvider', 'uploadProvider'],
  providerDetail: ['copyRequiredProviders', 'selectVersion', 'deprecateDelete'],
  apiDocs: ['authenticate', 'browseEndpoints'],
  dashboard: ['healthBar', 'statCards', 'recentSyncActivity', 'quickLinks'],
  users: ['createUser', 'editUser', 'deleteUser'],
  organizations: ['createOrganization', 'manageMembers', 'deleteOrganization'],
  roles: ['viewScopes', 'assignToUser'],
  oidcGroups: ['groupClaimName', 'defaultRole', 'addMapping', 'roleTemplates', 'saveChanges'],
  apiKeys: ['createKey', 'revokeKey', 'useKey'],
  upload: ['uploadModule', 'uploadProvider', 'scmLinking'],
  scmProviders: ['addProvider', 'reconnect', 'linkModule'],
  mirrors: ['createMirror', 'triggerSync', 'viewSyncHistory'],
  storage: ['switchBackend', 'testConnection', 'localStorage'],
  terraformBinaries: ['viewVersions', 'downloadUrl', 'adminConfiguration'],
  terraformBinaryDetail: [
    'expandPlatforms',
    'downloadUrl',
    'deprecateVersion',
    'deleteVersion',
    'restoreDeprecatedVersion',
  ],
  terraformMirror: ['createMirrorConfig', 'syncVersions', 'inspectPlatforms', 'enableDisable', 'deleteConfig'],
  approvals: ['reviewRequest', 'createRequest', 'filterByStatus', 'mirrorPolicyLink'],
  mirrorPolicies: ['createPolicy', 'allowVsDeny', 'requireApproval', 'priority', 'evaluatePolicy', 'enableDisable'],
  auditLogs: ['filterByResourceType', 'filterByAction', 'filterByUser', 'dateRange', 'viewDetail', 'export'],
  securityScanning: ['viewConfiguration', 'summaryStatistics', 'reviewScanResults'],
  mtls: ['viewStatus', 'certificateMappings', 'configurationSource'],
  scim: ['endpointUrls', 'authentication', 'supportedOperations'],
};

function makeContent(key: string, t: TStr): HelpContent {
  const actionKeys = HELP_ACTION_KEYS[key] ?? [];
  return {
    title: t(`help.${key}.title`),
    overview: t(`help.${key}.overview`),
    actions: actionKeys.map((ak) => ({
      heading: t(`help.${key}.actions.${ak}.heading`),
      text: t(`help.${key}.actions.${ak}.text`),
    })),
  };
}

function getHelpContent(pathname: string, t: TStr): HelpContent {
  // Parameterized routes — check before their parent prefix
  const segments = pathname.split('/').filter(Boolean);
  if (segments[0] === 'modules' && segments.length >= 3) return makeContent('moduleDetail', t);
  if (segments[0] === 'providers' && segments.length >= 2) return makeContent('providerDetail', t);
  if (segments[0] === 'terraform-binaries' && segments.length >= 2) return makeContent('terraformBinaryDetail', t);

  switch (pathname) {
    case '/': return makeContent('home', t);
    case '/modules': return makeContent('modules', t);
    case '/providers': return makeContent('providers', t);
    case '/terraform-binaries': return makeContent('terraformBinaries', t);
    case '/api-docs': return makeContent('apiDocs', t);
    case '/admin': return makeContent('dashboard', t);
    case '/admin/users': return makeContent('users', t);
    case '/admin/organizations': return makeContent('organizations', t);
    case '/admin/roles': return makeContent('roles', t);
    case '/admin/oidc': return makeContent('oidcGroups', t);
    case '/admin/apikeys': return makeContent('apiKeys', t);
    case '/admin/upload': return makeContent('upload', t);
    case '/admin/scm-providers': return makeContent('scmProviders', t);
    case '/admin/mirrors': return makeContent('mirrors', t);
    case '/admin/storage': return makeContent('storage', t);
    case '/admin/audit-logs': return makeContent('auditLogs', t);
    case '/admin/terraform-mirror': return makeContent('terraformMirror', t);
    case '/admin/approvals': return makeContent('approvals', t);
    case '/admin/policies': return makeContent('mirrorPolicies', t);
    case '/admin/security-scanning': return makeContent('securityScanning', t);
    case '/admin/mtls': return makeContent('mtls', t);
    case '/admin/scim': return makeContent('scim', t);
    default: return makeContent('default', t);
  }
}

const HelpPanel = () => {
  const { helpOpen, closeHelp } = useHelp();
  const { pathname } = useLocation();
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const content = getHelpContent(pathname, t);

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
