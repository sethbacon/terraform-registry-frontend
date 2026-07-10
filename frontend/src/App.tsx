import { lazy } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { CssBaseline } from '@mui/material'
import { ThemeProvider } from './contexts/ThemeContext'
import { AuthProvider } from './contexts/AuthContext'
import { HelpProvider } from './contexts/HelpContext'
import { AnnouncerProvider } from './contexts/AnnouncerContext'
import { ConsentProvider } from './contexts/ConsentContext'
import Layout from './components/Layout'
import ConsentBanner from './components/ConsentBanner'
import TelemetryGate from './components/TelemetryGate'
import OfflineBanner from './components/OfflineBanner'
import ErrorBoundary from './components/ErrorBoundary'
import LazyRoute from './components/LazyRoute'
import RouteFocusManager from './components/RouteFocusManager'
import { ADMIN_ROUTE_SCOPES } from './routeScopes'
// Critical-path pages loaded eagerly (small, always needed on first visit)
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import CallbackPage from './pages/CallbackPage'
import SetupWizardPage from './pages/SetupWizardPage'
import ModulesPage from './pages/ModulesPage'
import ProvidersPage from './pages/ProvidersPage'
import TerraformBinariesPage from './pages/TerraformBinariesPage'
// Non-critical pages loaded lazily (split into separate chunks)
const ModuleDetailPage = lazy(() => import('./pages/ModuleDetailPage'))
const ProviderDetailPage = lazy(() => import('./pages/ProviderDetailPage'))
const TerraformBinaryDetailPage = lazy(() => import('./pages/TerraformBinaryDetailPage'))
const ApiDocumentation = lazy(() => import('./pages/ApiDocumentation'))
const DashboardPage = lazy(() => import('./pages/admin/DashboardPage'))
const UsersPage = lazy(() => import('./pages/admin/UsersPage'))
const OrganizationsPage = lazy(() => import('./pages/admin/OrganizationsPage'))
const APIKeysPage = lazy(() => import('./pages/admin/APIKeysPage'))
const ModuleUploadPage = lazy(() => import('./pages/admin/ModuleUploadPage'))
const ProviderUploadPage = lazy(() => import('./pages/admin/ProviderUploadPage'))
const SCMProvidersPage = lazy(() => import('./pages/admin/SCMProvidersPage'))
const MirrorsPage = lazy(() => import('./pages/admin/MirrorsPage'))
const RolesPage = lazy(() => import('./pages/admin/RolesPage'))
const StoragePage = lazy(() => import('./pages/admin/StoragePage'))
const TerraformMirrorPage = lazy(() => import('./pages/admin/TerraformMirrorPage'))
const ApprovalsPage = lazy(() => import('./pages/admin/ApprovalsPage'))
const VersionApprovalsPage = lazy(() => import('./pages/admin/VersionApprovalsPage'))
const MirrorPoliciesPage = lazy(() => import('./pages/admin/MirrorPoliciesPage'))
const OIDCSettingsPage = lazy(() => import('./pages/admin/OIDCSettingsPage'))
const SCIMProvisioningPage = lazy(() => import('./pages/admin/SCIMProvisioningPage'))
const MTLSPage = lazy(() => import('./pages/admin/MTLSPage'))
const AuditLogPage = lazy(() => import('./pages/admin/AuditLogPage'))
const SecurityScanningPage = lazy(() => import('./pages/admin/SecurityScanningPage'))
const NotificationsPage = lazy(() => import('./pages/admin/NotificationsPage'))
const ComponentShowcase = lazy(() => import('./pages/dev/ComponentShowcase'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

function App() {
  return (
    <ThemeProvider>
      <CssBaseline />
      <ConsentProvider>
        <AuthProvider>
          <HelpProvider>
            <AnnouncerProvider>
              <QueryClientProvider client={queryClient}>
                <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                  <RouteFocusManager />
                  <ErrorBoundary>
                    <Routes>
                      {/* Public routes */}
                      <Route path="/login" element={<LoginPage />} />
                      <Route path="/auth/callback" element={<CallbackPage />} />
                      <Route path="/setup" element={<SetupWizardPage />} />

                      {/* Layout routes */}
                      <Route element={<Layout />}>
                        <Route path="/" element={<HomePage />} />

                        {/* Modules */}
                        <Route path="/modules" element={<ModulesPage />} />
                        <Route
                          path="/modules/:namespace/:name/:system"
                          element={<LazyRoute Component={ModuleDetailPage} />}
                        />

                        {/* Providers */}
                        <Route path="/providers" element={<ProvidersPage />} />
                        <Route
                          path="/providers/:namespace/:type"
                          element={<LazyRoute Component={ProviderDetailPage} />}
                        />

                        {/* Terraform Binaries */}
                        <Route path="/terraform-binaries" element={<TerraformBinariesPage />} />
                        <Route
                          path="/terraform-binaries/:name"
                          element={<LazyRoute Component={TerraformBinaryDetailPage} />}
                        />

                        {/* API Documentation */}
                        <Route
                          path="/api-docs"
                          element={<LazyRoute Component={ApiDocumentation} />}
                        />

                        {/* Settings & Privacy */}
                        <Route path="/settings" element={<LazyRoute Component={SettingsPage} />} />

                        {/* Admin routes (protected with scope requirements from routeScopes.ts) */}
                        <Route
                          path="/admin"
                          element={
                            <LazyRoute
                              Component={DashboardPage}
                              requiredScope={ADMIN_ROUTE_SCOPES['/admin']}
                            />
                          }
                        />
                        <Route
                          path="/admin/users"
                          element={
                            <LazyRoute
                              Component={UsersPage}
                              requiredScope={ADMIN_ROUTE_SCOPES['/admin/users']}
                            />
                          }
                        />
                        <Route
                          path="/admin/organizations"
                          element={
                            <LazyRoute
                              Component={OrganizationsPage}
                              requiredScope={ADMIN_ROUTE_SCOPES['/admin/organizations']}
                            />
                          }
                        />
                        <Route
                          path="/admin/roles"
                          element={
                            <LazyRoute
                              Component={RolesPage}
                              requiredScope={ADMIN_ROUTE_SCOPES['/admin/roles']}
                            />
                          }
                        />
                        <Route
                          path="/admin/apikeys"
                          element={
                            <LazyRoute
                              Component={APIKeysPage}
                              requiredScope={ADMIN_ROUTE_SCOPES['/admin/apikeys']}
                            />
                          }
                        />
                        <Route
                          path="/admin/upload"
                          element={<Navigate to="/admin/upload/module" replace />}
                        />
                        <Route
                          path="/admin/upload/module"
                          element={
                            <LazyRoute
                              Component={ModuleUploadPage}
                              requiredScope={ADMIN_ROUTE_SCOPES['/admin/upload/module']}
                            />
                          }
                        />
                        <Route
                          path="/admin/upload/provider"
                          element={
                            <LazyRoute
                              Component={ProviderUploadPage}
                              requiredScope={ADMIN_ROUTE_SCOPES['/admin/upload/provider']}
                            />
                          }
                        />
                        <Route
                          path="/admin/scm-providers"
                          element={
                            <LazyRoute
                              Component={SCMProvidersPage}
                              requiredScope={ADMIN_ROUTE_SCOPES['/admin/scm-providers']}
                            />
                          }
                        />
                        <Route
                          path="/admin/mirrors"
                          element={
                            <LazyRoute
                              Component={MirrorsPage}
                              requiredScope={ADMIN_ROUTE_SCOPES['/admin/mirrors']}
                            />
                          }
                        />
                        <Route
                          path="/admin/terraform-mirror"
                          element={
                            <LazyRoute
                              Component={TerraformMirrorPage}
                              requiredScope={ADMIN_ROUTE_SCOPES['/admin/terraform-mirror']}
                            />
                          }
                        />
                        <Route
                          path="/admin/storage"
                          element={
                            <LazyRoute
                              Component={StoragePage}
                              requiredScope={ADMIN_ROUTE_SCOPES['/admin/storage']}
                            />
                          }
                        />
                        <Route
                          path="/admin/approvals"
                          element={
                            <LazyRoute
                              Component={ApprovalsPage}
                              requiredScope={ADMIN_ROUTE_SCOPES['/admin/approvals']}
                            />
                          }
                        />
                        <Route
                          path="/admin/version-approvals"
                          element={
                            <LazyRoute
                              Component={VersionApprovalsPage}
                              requiredScope={ADMIN_ROUTE_SCOPES['/admin/version-approvals']}
                            />
                          }
                        />
                        <Route
                          path="/admin/policies"
                          element={
                            <LazyRoute
                              Component={MirrorPoliciesPage}
                              requiredScope={ADMIN_ROUTE_SCOPES['/admin/policies']}
                            />
                          }
                        />
                        <Route
                          path="/admin/oidc"
                          element={
                            <LazyRoute
                              Component={OIDCSettingsPage}
                              requiredScope={ADMIN_ROUTE_SCOPES['/admin/oidc']}
                            />
                          }
                        />
                        <Route
                          path="/admin/scim"
                          element={
                            <LazyRoute
                              Component={SCIMProvisioningPage}
                              requiredScope={ADMIN_ROUTE_SCOPES['/admin/scim']}
                            />
                          }
                        />
                        <Route
                          path="/admin/mtls"
                          element={
                            <LazyRoute
                              Component={MTLSPage}
                              requiredScope={ADMIN_ROUTE_SCOPES['/admin/mtls']}
                            />
                          }
                        />
                        <Route
                          path="/admin/audit-logs"
                          element={
                            <LazyRoute
                              Component={AuditLogPage}
                              requiredScope={ADMIN_ROUTE_SCOPES['/admin/audit-logs']}
                            />
                          }
                        />
                        <Route
                          path="/admin/security-scanning"
                          element={
                            <LazyRoute
                              Component={SecurityScanningPage}
                              requiredScope={ADMIN_ROUTE_SCOPES['/admin/security-scanning']}
                            />
                          }
                        />
                        <Route
                          path="/admin/notifications"
                          element={
                            <LazyRoute
                              Component={NotificationsPage}
                              requiredScope={ADMIN_ROUTE_SCOPES['/admin/notifications']}
                            />
                          }
                        />

                        {/* Dev-only routes */}
                        {import.meta.env.DEV && (
                          <Route
                            path="/dev/components"
                            element={<LazyRoute Component={ComponentShowcase} />}
                          />
                        )}

                        {/* Catch all */}
                        <Route path="*" element={<Navigate to="/" replace />} />
                      </Route>
                    </Routes>
                  </ErrorBoundary>
                </Router>
                <ReactQueryDevtools initialIsOpen={false} />
              </QueryClientProvider>
            </AnnouncerProvider>
          </HelpProvider>
        </AuthProvider>
        <ConsentBanner />
        <TelemetryGate />
      </ConsentProvider>
      <OfflineBanner />
    </ThemeProvider>
  )
}

export default App
