import { Link as RouterLink, useLocation } from 'react-router-dom';
import { Breadcrumbs, Link, Typography, Box } from '@mui/material';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';

export interface BreadcrumbEntry {
  label: string;
  to?: string;
}

/** Map of admin path segment → human-readable label. */
const LABELS: Record<string, string> = {
  admin: 'Dashboard',
  users: 'Users',
  organizations: 'Organizations',
  roles: 'Roles',
  apikeys: 'API Keys',
  upload: 'Upload',
  module: 'Module',
  provider: 'Provider',
  'scm-providers': 'Source Control',
  mirrors: 'Provider Mirrors',
  'terraform-mirror': 'Binary Mirrors',
  storage: 'Storage',
  approvals: 'Approvals',
  policies: 'Mirror Policies',
  oidc: 'OIDC Groups',
  'audit-logs': 'Audit Logs',
  'security-scanning': 'Security Scanning',
};

/** Map of admin path segment → route destination (for making crumbs clickable). */
const LINKS: Record<string, string> = {
  admin: '/admin',
  users: '/admin/users',
  organizations: '/admin/organizations',
  roles: '/admin/roles',
  apikeys: '/admin/apikeys',
  'scm-providers': '/admin/scm-providers',
  mirrors: '/admin/mirrors',
  'terraform-mirror': '/admin/terraform-mirror',
  storage: '/admin/storage',
  approvals: '/admin/approvals',
  policies: '/admin/policies',
  oidc: '/admin/oidc',
  'audit-logs': '/admin/audit-logs',
  'security-scanning': '/admin/security-scanning',
};

/** Build the breadcrumb trail from a pathname. */
export function buildAdminBreadcrumbs(pathname: string): BreadcrumbEntry[] {
  const parts = pathname.split('/').filter(Boolean);
  if (parts[0] !== 'admin') return [];

  const crumbs: BreadcrumbEntry[] = [];
  let seen = '';
  for (let i = 0; i < parts.length; i++) {
    const segment = parts[i];
    seen = seen ? `${seen}/${segment}` : segment;
    const label = LABELS[segment];
    if (!label) continue;
    const linked = LINKS[segment] ?? `/${seen}`;
    crumbs.push({
      label,
      // Final crumb is the current page — rendered as plain text.
      to: i === parts.length - 1 ? undefined : linked,
    });
  }
  return crumbs;
}

export interface AdminBreadcrumbsProps {
  'data-testid'?: string;
}

export default function AdminBreadcrumbs({
  'data-testid': testId = 'admin-breadcrumbs',
}: AdminBreadcrumbsProps) {
  const location = useLocation();
  const crumbs = buildAdminBreadcrumbs(location.pathname);

  // No crumbs for non-admin pages, or only the dashboard crumb (don't show a single-item trail).
  if (crumbs.length < 2) return null;

  return (
    <Box sx={{ mb: 2 }} data-testid={testId}>
      <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} aria-label="breadcrumb">
        {crumbs.map((c, i) => {
          const isLast = i === crumbs.length - 1;
          if (isLast || !c.to) {
            return (
              <Typography key={i} color="text.primary" variant="body2">
                {c.label}
              </Typography>
            );
          }
          return (
            <Link
              key={i}
              component={RouterLink}
              to={c.to}
              underline="hover"
              color="inherit"
              variant="body2"
            >
              {c.label}
            </Link>
          );
        })}
      </Breadcrumbs>
    </Box>
  );
}
