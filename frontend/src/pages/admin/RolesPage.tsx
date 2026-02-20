import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  Chip,
  Stack,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tooltip,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ShieldIcon from '@mui/icons-material/Shield';
import LockIcon from '@mui/icons-material/Lock';
import AdminIcon from '@mui/icons-material/AdminPanelSettings';
import api from '../../services/api';
import { RoleTemplate, AVAILABLE_SCOPES } from '../../types/rbac';

// Scope category groupings for better organization
const SCOPE_CATEGORIES: Record<string, string[]> = {
  'Registry Access': ['modules:read', 'modules:write', 'providers:read', 'providers:write'],
  'DevOps': ['mirrors:read', 'mirrors:manage', 'scm:read', 'scm:manage'],
  'User & Organization': ['users:read', 'users:write', 'organizations:read', 'organizations:write'],
  'System': ['api_keys:manage', 'audit:read', 'admin'],
};

// Get scope info from AVAILABLE_SCOPES
const getScopeInfo = (scopeValue: string) => {
  return AVAILABLE_SCOPES.find((s) => s.value === scopeValue) || {
    value: scopeValue,
    label: scopeValue,
    description: 'Unknown scope',
  };
};

// Get color for scope chip based on category
const getScopeColor = (scope: string): 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' => {
  if (scope === 'admin') return 'error';
  if (scope.includes(':write') || scope.includes(':manage')) return 'warning';
  if (scope.includes(':read')) return 'success';
  return 'default';
};

const RolesPage: React.FC = () => {
  const [roles, setRoles] = useState<RoleTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRole, setExpandedRole] = useState<string | false>(false);

  useEffect(() => {
    loadRoles();
  }, []);

  const loadRoles = async () => {
    try {
      setLoading(true);
      setError(null);
      const templates = await api.listRoleTemplates();
      // Sort: system roles first (in logical order), then custom roles
      const roleOrder = ['viewer', 'publisher', 'mirror_manager', 'admin'];
      const sorted = [...templates].sort((a, b) => {
        if (a.is_system && !b.is_system) return -1;
        if (!a.is_system && b.is_system) return 1;
        if (a.is_system && b.is_system) {
          return roleOrder.indexOf(a.name) - roleOrder.indexOf(b.name);
        }
        return a.name.localeCompare(b.name);
      });
      setRoles(sorted);
    } catch (err) {
      console.error('Failed to load roles:', err);
      setError('Failed to load roles. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAccordionChange = (roleId: string) => (_: React.SyntheticEvent, isExpanded: boolean) => {
    setExpandedRole(isExpanded ? roleId : false);
  };

  if (loading) {
    return (
      <Container maxWidth="lg">
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      <Box sx={{ mb: 4 }}>
        <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
          <ShieldIcon sx={{ fontSize: 32, color: 'primary.main' }} />
          <Typography variant="h4" component="h1">
            Roles & Permissions
          </Typography>
        </Stack>
        <Typography variant="body1" color="text.secondary">
          View the available roles and their associated permission scopes. System roles are predefined
          and cannot be modified.
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Scope Reference */}
      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          Available Scopes Reference
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Scopes define what actions a role can perform in the registry.
        </Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell><strong>Scope</strong></TableCell>
                <TableCell><strong>Description</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {AVAILABLE_SCOPES.map((scope) => (
                <TableRow key={scope.value}>
                  <TableCell>
                    <Chip
                      label={scope.label}
                      size="small"
                      color={getScopeColor(scope.value)}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>{scope.description}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Roles List */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Role Templates
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Click on a role to see its full scope details.
        </Typography>

        {roles.length === 0 ? (
          <Alert severity="info">No roles found.</Alert>
        ) : (
          <Box>
            {roles.map((role) => (
              <Accordion
                key={role.id}
                expanded={expandedRole === role.id}
                onChange={handleAccordionChange(role.id)}
                sx={{
                  mb: 1,
                  '&:before': { display: 'none' },
                  border: 1,
                  borderColor: 'divider',
                }}
              >
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon />}
                  sx={{
                    backgroundColor: (theme) =>
                      theme.palette.mode === 'dark' ? 'grey.900' : 'grey.50',
                  }}
                >
                  <Stack direction="row" alignItems="center" spacing={2} sx={{ width: '100%', pr: 2 }}>
                    {role.name === 'admin' ? (
                      <AdminIcon color="error" />
                    ) : role.is_system ? (
                      <LockIcon color="action" />
                    ) : (
                      <ShieldIcon color="primary" />
                    )}
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="subtitle1" component="span" fontWeight="medium">
                        {role.display_name}
                      </Typography>
                      {role.is_system && (
                        <Chip
                          label="System"
                          size="small"
                          color="default"
                          sx={{ ml: 1, height: 20, fontSize: '0.7rem' }}
                        />
                      )}
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      {role.scopes.length} scope{role.scopes.length !== 1 ? 's' : ''}
                    </Typography>
                  </Stack>
                </AccordionSummary>
                <AccordionDetails sx={{ pt: 2 }}>
                  {role.description && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {role.description}
                    </Typography>
                  )}

                  <Typography variant="subtitle2" gutterBottom>
                    Assigned Scopes:
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
                    {role.scopes.map((scope) => {
                      const scopeInfo = getScopeInfo(scope);
                      return (
                        <Tooltip key={scope} title={scopeInfo.description} arrow>
                          <Chip
                            label={scopeInfo.label}
                            size="small"
                            color={getScopeColor(scope)}
                          />
                        </Tooltip>
                      );
                    })}
                  </Stack>

                  {/* Scope breakdown by category */}
                  <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                    Permissions by Category:
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableBody>
                        {Object.entries(SCOPE_CATEGORIES).map(([category, categoryScopes]) => {
                          const matchingScopes = role.scopes.filter((s) =>
                            categoryScopes.includes(s) || (s === 'admin')
                          );
                          // Admin scope grants all permissions
                          const hasAdminScope = role.scopes.includes('admin');

                          return (
                            <TableRow key={category}>
                              <TableCell sx={{ fontWeight: 'medium', width: 200 }}>
                                {category}
                              </TableCell>
                              <TableCell>
                                {hasAdminScope && category !== 'System' ? (
                                  <Chip
                                    label="Full Access (via Admin)"
                                    size="small"
                                    color="error"
                                    variant="outlined"
                                  />
                                ) : matchingScopes.length > 0 ? (
                                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                                    {matchingScopes.map((scope) => {
                                      const scopeInfo = getScopeInfo(scope);
                                      return (
                                        <Chip
                                          key={scope}
                                          label={scopeInfo.label}
                                          size="small"
                                          color={getScopeColor(scope)}
                                          variant="outlined"
                                        />
                                      );
                                    })}
                                  </Stack>
                                ) : (
                                  <Typography variant="body2" color="text.disabled">
                                    No access
                                  </Typography>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  {/* Metadata */}
                  <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                    <Typography variant="caption" color="text.secondary">
                      Role ID: {role.id} | Created: {new Date(role.created_at).toLocaleDateString()}
                      {role.updated_at !== role.created_at && (
                        <> | Updated: {new Date(role.updated_at).toLocaleDateString()}</>
                      )}
                    </Typography>
                  </Box>
                </AccordionDetails>
              </Accordion>
            ))}
          </Box>
        )}
      </Paper>
    </Container>
  );
};

export default RolesPage;
