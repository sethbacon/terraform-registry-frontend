import React from 'react';
import { Command } from 'cmdk';
import { useNavigate } from 'react-router-dom';
import { Box, Dialog, Typography, useTheme } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import type { Module, Provider } from '../types';

export interface CommandPaletteNavItem {
  label: string;
  path: string;
  /** If set, the entry is hidden unless the user has the scope (or 'admin'). */
  scope?: string | null;
  group: 'Navigation' | 'Admin';
  keywords?: string[];
}

/** Default navigation commands. Exported for unit tests. */
export const defaultCommands: CommandPaletteNavItem[] = [
  { label: 'Home', path: '/', group: 'Navigation' },
  { label: 'Modules', path: '/modules', group: 'Navigation' },
  { label: 'Providers', path: '/providers', group: 'Navigation' },
  { label: 'Terraform Binaries', path: '/terraform', group: 'Navigation' },
  { label: 'Admin Dashboard', path: '/admin', scope: 'admin', group: 'Admin' },
  { label: 'Organizations', path: '/admin/organizations', scope: 'organizations:read', group: 'Admin' },
  { label: 'Roles', path: '/admin/roles', scope: 'users:read', group: 'Admin' },
  { label: 'Users', path: '/admin/users', scope: 'users:read', group: 'Admin' },
  { label: 'OIDC Groups', path: '/admin/oidc', scope: 'admin', group: 'Admin' },
  { label: 'API Keys', path: '/admin/apikeys', group: 'Admin' },
  { label: 'Source Control', path: '/admin/scm-providers', scope: 'scm:read', group: 'Admin' },
  { label: 'Provider Mirrors', path: '/admin/mirrors', scope: 'mirrors:read', group: 'Admin' },
  { label: 'Binary Mirrors', path: '/admin/terraform-mirror', scope: 'mirrors:read', group: 'Admin' },
  { label: 'Mirror Approvals', path: '/admin/approvals', scope: 'mirrors:read', group: 'Admin' },
  { label: 'Mirror Policies', path: '/admin/policies', scope: 'admin', group: 'Admin' },
  { label: 'Storage', path: '/admin/storage', scope: 'admin', group: 'Admin' },
  { label: 'Security Scanning', path: '/admin/security-scanning', scope: 'admin', group: 'Admin' },
  { label: 'Audit Logs', path: '/admin/audit-logs', scope: 'audit:read', group: 'Admin' },
  { label: 'Publish Module', path: '/admin/upload/module', scope: 'modules:publish', group: 'Admin', keywords: ['upload'] },
  { label: 'Upload Provider', path: '/admin/upload/provider', scope: 'providers:publish', group: 'Admin', keywords: ['publish'] },
];

export function filterByScope(
  items: CommandPaletteNavItem[],
  allowedScopes: string[],
): CommandPaletteNavItem[] {
  if (allowedScopes.includes('admin')) return items;
  return items.filter((item) => !item.scope || allowedScopes.includes(item.scope));
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

const CommandPalette: React.FC<CommandPaletteProps> = ({ open, onClose }) => {
  const navigate = useNavigate();
  const theme = useTheme();
  const { allowedScopes, isAuthenticated } = useAuth();

  const [search, setSearch] = React.useState('');
  const [modules, setModules] = React.useState<Module[]>([]);
  const [providers, setProviders] = React.useState<Provider[]>([]);

  // Reset on open/close.
  React.useEffect(() => {
    if (!open) setSearch('');
  }, [open]);

  // Debounced registry search.
  React.useEffect(() => {
    if (!open) return;
    const q = search.trim();
    if (q.length < 2) {
      setModules([]);
      setProviders([]);
      return;
    }
    const handle = window.setTimeout(async () => {
      try {
        const [m, p] = await Promise.all([
          api.searchModules({ query: q, limit: 5 }).catch(() => ({ modules: [] })),
          api.searchProviders({ query: q, limit: 5 }).catch(() => ({ providers: [] })),
        ]);
        setModules(Array.isArray(m?.modules) ? m.modules : []);
        setProviders(Array.isArray(p?.providers) ? p.providers : []);
      } catch {
        // silently ignore search failures — palette is best-effort
      }
    }, 200);
    return () => window.clearTimeout(handle);
  }, [search, open]);

  const visibleNav = React.useMemo(
    () => filterByScope(defaultCommands, allowedScopes),
    [allowedScopes],
  );
  const navigation = visibleNav.filter((i) => i.group === 'Navigation');
  const admin = isAuthenticated ? visibleNav.filter((i) => i.group === 'Admin') : [];

  const go = (path: string) => {
    onClose();
    navigate(path);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{ sx: { overflow: 'hidden' } }}
      data-testid="command-palette"
    >
      <Command label="Command Palette" shouldFilter>
        <Box
          sx={{
            borderBottom: 1,
            borderColor: 'divider',
            p: 1.5,
          }}
        >
          <Command.Input
            autoFocus
            value={search}
            onValueChange={setSearch}
            placeholder="Search pages, modules, providers…"
            data-testid="command-palette-input"
            style={{
              width: '100%',
              border: 'none',
              outline: 'none',
              background: 'transparent',
              color: theme.palette.text.primary,
              fontSize: '1rem',
              padding: '0.5rem',
            }}
          />
        </Box>
        <Command.List
          style={{
            maxHeight: 400,
            overflowY: 'auto',
            padding: '0.5rem 0',
          }}
        >
          <Command.Empty>
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                No results.
              </Typography>
            </Box>
          </Command.Empty>

          {navigation.length > 0 && (
            <Command.Group heading="Navigation">
              {navigation.map((item) => (
                <PaletteItem
                  key={item.path}
                  value={`nav-${item.path} ${item.label} ${item.keywords?.join(' ') ?? ''}`}
                  label={item.label}
                  hint={item.path}
                  onSelect={() => go(item.path)}
                />
              ))}
            </Command.Group>
          )}

          {admin.length > 0 && (
            <Command.Group heading="Admin">
              {admin.map((item) => (
                <PaletteItem
                  key={item.path}
                  value={`admin-${item.path} ${item.label} ${item.keywords?.join(' ') ?? ''}`}
                  label={item.label}
                  hint={item.path}
                  onSelect={() => go(item.path)}
                />
              ))}
            </Command.Group>
          )}

          {modules.length > 0 && (
            <Command.Group heading="Modules">
              {modules.map((m) => {
                const path = `/modules/${m.namespace}/${m.name}/${m.provider ?? m.system ?? ''}`;
                return (
                  <PaletteItem
                    key={`mod-${m.id ?? path}`}
                    value={`module-${path}`}
                    label={`${m.namespace}/${m.name}`}
                    hint={m.provider ?? m.system ?? ''}
                    onSelect={() => go(path)}
                  />
                );
              })}
            </Command.Group>
          )}

          {providers.length > 0 && (
            <Command.Group heading="Providers">
              {providers.map((p) => {
                const path = `/providers/${p.namespace}/${p.type}`;
                return (
                  <PaletteItem
                    key={`prov-${p.id ?? path}`}
                    value={`provider-${path}`}
                    label={`${p.namespace}/${p.type}`}
                    hint="Provider"
                    onSelect={() => go(path)}
                  />
                );
              })}
            </Command.Group>
          )}
        </Command.List>
      </Command>
    </Dialog>
  );
};

interface PaletteItemProps {
  value: string;
  label: string;
  hint?: string;
  onSelect: () => void;
}

const PaletteItem: React.FC<PaletteItemProps> = ({ value, label, hint, onSelect }) => {
  return (
    <Command.Item value={value} onSelect={onSelect}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          px: 3,
          py: 1,
          cursor: 'pointer',
          '&[data-selected="true"], &:hover': {
            bgcolor: 'action.hover',
          },
        }}
      >
        <Typography variant="body2">{label}</Typography>
        {hint && (
          <Typography variant="caption" color="text.secondary">
            {hint}
          </Typography>
        )}
      </Box>
    </Command.Item>
  );
};

export default CommandPalette;
