import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
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
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ShieldIcon from '@mui/icons-material/Shield'
import LockIcon from '@mui/icons-material/Lock'
import AdminIcon from '@mui/icons-material/AdminPanelSettings'
import api from '../../services/api'
import { RoleTemplate, AVAILABLE_SCOPES } from '../../types/rbac'
import { getScopeInfo, getScopeColor } from '../../utils'
import { queryKeys } from '../../services/queryKeys'

// Scope category groupings for better organization
const SCOPE_CATEGORIES: Record<string, string[]> = {
  'Registry Access': ['modules:read', 'modules:write', 'providers:read', 'providers:write'],
  DevOps: ['mirrors:read', 'mirrors:manage', 'scm:read', 'scm:manage'],
  'User & Organization': ['users:read', 'users:write', 'organizations:read', 'organizations:write'],
  System: ['api_keys:manage', 'audit:read', 'scanning:read', 'admin'],
}

const RolesPage: React.FC = () => {
  const { t } = useTranslation()
  const [expandedRole, setExpandedRole] = useState<string | false>(false)

  const {
    data: roles = [],
    isLoading: loading,
    error: queryError,
  } = useQuery<RoleTemplate[]>({
    queryKey: queryKeys.roles.list(),
    queryFn: async () => {
      const templates = await api.listRoleTemplates()
      const roleOrder = ['viewer', 'publisher', 'devops', 'user_manager', 'auditor', 'admin']
      return [...templates].sort((a, b) => {
        if (a.is_system && !b.is_system) return -1
        if (!a.is_system && b.is_system) return 1
        if (a.is_system && b.is_system) {
          return roleOrder.indexOf(a.name) - roleOrder.indexOf(b.name)
        }
        return a.name.localeCompare(b.name)
      })
    },
  })

  const error = queryError ? t('admin.roles.loadError') : null

  const handleAccordionChange =
    (roleId: string) => (_: React.SyntheticEvent, isExpanded: boolean) => {
      setExpandedRole(isExpanded ? roleId : false)
    }

  return (
    <Container maxWidth="lg" aria-busy={loading} aria-live="polite">
      {loading ? (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '400px',
          }}
        >
          <CircularProgress />
        </Box>
      ) : (
        <>
          <Box sx={{ mb: 4 }}>
            <Stack
              direction="row"
              spacing={2}
              sx={{
                alignItems: 'center',
                mb: 2,
              }}
            >
              <ShieldIcon sx={{ fontSize: 32, color: 'primary.main' }} />
              <Typography variant="h4" component="h1">
                {t('admin.roles.title')}
              </Typography>
            </Stack>
            <Typography
              variant="body1"
              sx={{
                color: 'text.secondary',
              }}
            >
              {t('admin.roles.subtitle')}
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
              {t('admin.roles.availableScopesReference')}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
                mb: 2,
              }}
            >
              {t('admin.roles.scopesDefine')}
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>
                      <strong>{t('admin.roles.thScope')}</strong>
                    </TableCell>
                    <TableCell>
                      <strong>{t('admin.roles.thDescription')}</strong>
                    </TableCell>
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
              {t('admin.roles.roleTemplates')}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
                mb: 3,
              }}
            >
              {t('admin.roles.clickRole')}
            </Typography>

            {roles.length === 0 ? (
              <Alert severity="info">{t('admin.roles.noRoles')}</Alert>
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
                      <Stack
                        direction="row"
                        spacing={2}
                        sx={{
                          alignItems: 'center',
                          width: '100%',
                          pr: 2,
                        }}
                      >
                        {role.name === 'admin' ? (
                          <AdminIcon color="error" />
                        ) : role.is_system ? (
                          <LockIcon color="action" />
                        ) : (
                          <ShieldIcon color="primary" />
                        )}
                        <Box sx={{ flexGrow: 1 }}>
                          <Typography
                            variant="subtitle1"
                            component="span"
                            sx={{
                              fontWeight: 'medium',
                            }}
                          >
                            {role.display_name}
                          </Typography>
                          {role.is_system && (
                            <Chip
                              label={t('admin.roles.systemChip')}
                              size="small"
                              color="default"
                              sx={{ ml: 1, height: 20, fontSize: '0.7rem' }}
                            />
                          )}
                        </Box>
                        <Typography
                          variant="body2"
                          sx={{
                            color: 'text.secondary',
                          }}
                        >
                          {t('admin.roles.scopeCount', { count: role.scopes.length })}
                        </Typography>
                      </Stack>
                    </AccordionSummary>
                    <AccordionDetails sx={{ pt: 2 }}>
                      {role.description && (
                        <Typography
                          variant="body2"
                          sx={{
                            color: 'text.secondary',
                            mb: 2,
                          }}
                        >
                          {role.description}
                        </Typography>
                      )}

                      <Typography variant="subtitle2" gutterBottom>
                        {t('admin.roles.assignedScopes')}
                      </Typography>
                      <Stack
                        direction="row"
                        spacing={1}
                        useFlexGap
                        sx={{
                          flexWrap: 'wrap',
                          mb: 2,
                        }}
                      >
                        {role.scopes.map((scope) => {
                          const scopeInfo = getScopeInfo(scope)
                          return (
                            <Tooltip key={scope} title={scopeInfo.description} arrow>
                              <Chip
                                label={scopeInfo.label}
                                size="small"
                                color={getScopeColor(scope)}
                              />
                            </Tooltip>
                          )
                        })}
                      </Stack>

                      {/* Scope breakdown by category */}
                      <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                        {t('admin.roles.permissionsByCategory')}
                      </Typography>
                      <TableContainer>
                        <Table size="small">
                          <TableBody>
                            {Object.entries(SCOPE_CATEGORIES).map(([category, categoryScopes]) => {
                              const matchingScopes = role.scopes.filter(
                                (s) => categoryScopes.includes(s) || s === 'admin',
                              )
                              // Admin scope grants all permissions
                              const hasAdminScope = role.scopes.includes('admin')

                              return (
                                <TableRow key={category}>
                                  <TableCell sx={{ fontWeight: 'medium', width: 200 }}>
                                    {category}
                                  </TableCell>
                                  <TableCell>
                                    {hasAdminScope && category !== 'System' ? (
                                      <Chip
                                        label={t('admin.roles.fullAccessViaAdmin')}
                                        size="small"
                                        color="error"
                                        variant="outlined"
                                      />
                                    ) : matchingScopes.length > 0 ? (
                                      <Stack
                                        direction="row"
                                        spacing={0.5}
                                        useFlexGap
                                        sx={{
                                          flexWrap: 'wrap',
                                        }}
                                      >
                                        {matchingScopes.map((scope) => {
                                          const scopeInfo = getScopeInfo(scope)
                                          return (
                                            <Chip
                                              key={scope}
                                              label={scopeInfo.label}
                                              size="small"
                                              color={getScopeColor(scope)}
                                              variant="outlined"
                                            />
                                          )
                                        })}
                                      </Stack>
                                    ) : (
                                      <Typography
                                        variant="body2"
                                        sx={{
                                          color: 'text.disabled',
                                        }}
                                      >
                                        No access
                                      </Typography>
                                    )}
                                  </TableCell>
                                </TableRow>
                              )
                            })}
                          </TableBody>
                        </Table>
                      </TableContainer>

                      {/* Metadata */}
                      <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                        <Typography
                          variant="caption"
                          sx={{
                            color: 'text.secondary',
                          }}
                        >
                          Role ID: {role.id} | Created:{' '}
                          {new Date(role.created_at).toLocaleDateString()}
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
        </>
      )}
    </Container>
  )
}

export default RolesPage
