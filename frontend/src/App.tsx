import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { CssBaseline } from '@mui/material';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import { HelpProvider } from './contexts/HelpContext';
import { AnnouncerProvider } from './contexts/AnnouncerContext';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
// Critical-path pages loaded eagerly (small, always needed on first visit)
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import CallbackPage from './pages/CallbackPage';
import SetupWizardPage from './pages/SetupWizardPage';
import ModulesPage from './pages/ModulesPage';
import ProvidersPage from './pages/ProvidersPage';
import TerraformBinariesPage from './pages/TerraformBinariesPage';
// Non-critical pages loaded lazily (split into separate chunks)
const ModuleDetailPage = lazy(() => import('./pages/ModuleDetailPage'));
const ProviderDetailPage = lazy(() => import('./pages/ProviderDetailPage'));
const TerraformBinaryDetailPage = lazy(() => import('./pages/TerraformBinaryDetailPage'));
const ApiDocumentation = lazy(() => import('./pages/ApiDocumentation'));
const DashboardPage = lazy(() => import('./pages/admin/DashboardPage'));
const UsersPage = lazy(() => import('./pages/admin/UsersPage'));
const OrganizationsPage = lazy(() => import('./pages/admin/OrganizationsPage'));
const APIKeysPage = lazy(() => import('./pages/admin/APIKeysPage'));
const ModuleUploadPage = lazy(() => import('./pages/admin/ModuleUploadPage'));
const ProviderUploadPage = lazy(() => import('./pages/admin/ProviderUploadPage'));
const SCMProvidersPage = lazy(() => import('./pages/admin/SCMProvidersPage'));
const MirrorsPage = lazy(() => import('./pages/admin/MirrorsPage'));
const RolesPage = lazy(() => import('./pages/admin/RolesPage'));
const StoragePage = lazy(() => import('./pages/admin/StoragePage'));
const TerraformMirrorPage = lazy(() => import('./pages/admin/TerraformMirrorPage'));
const ApprovalsPage = lazy(() => import('./pages/admin/ApprovalsPage'));
const MirrorPoliciesPage = lazy(() => import('./pages/admin/MirrorPoliciesPage'));
const OIDCSettingsPage = lazy(() => import('./pages/admin/OIDCSettingsPage'));
const SCIMProvisioningPage = lazy(() => import('./pages/admin/SCIMProvisioningPage'));
const MTLSPage = lazy(() => import('./pages/admin/MTLSPage'));
const AuditLogPage = lazy(() => import('./pages/admin/AuditLogPage'));
const SecurityScanningPage = lazy(() => import('./pages/admin/SecurityScanningPage'));
const ComponentShowcase = lazy(() => import('./pages/dev/ComponentShowcase'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const loader = <div>Loading...</div>;

function App() {
  return (
    <ThemeProvider>
      <CssBaseline />
      <AuthProvider>
        <HelpProvider>
          <AnnouncerProvider>
            <QueryClientProvider client={queryClient}>
              <Router>
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
                      <Route path="/modules/:namespace/:name/:system" element={<ErrorBoundary><Suspense fallback={loader}><ModuleDetailPage /></Suspense></ErrorBoundary>} />

                      {/* Providers */}
                      <Route path="/providers" element={<ProvidersPage />} />
                      <Route path="/providers/:namespace/:type" element={<ErrorBoundary><Suspense fallback={loader}><ProviderDetailPage /></Suspense></ErrorBoundary>} />

                      {/* Terraform Binaries */}
                      <Route path="/terraform-binaries" element={<TerraformBinariesPage />} />
                      <Route path="/terraform-binaries/:name" element={<ErrorBoundary><Suspense fallback={loader}><TerraformBinaryDetailPage /></Suspense></ErrorBoundary>} />

                      {/* API Documentation */}
                      <Route path="/api-docs" element={<ErrorBoundary><Suspense fallback={loader}><ApiDocumentation /></Suspense></ErrorBoundary>} />

                      {/* Admin routes (protected with scope requirements) */}
                      <Route path="/admin" element={<ProtectedRoute><ErrorBoundary><Suspense fallback={loader}><DashboardPage /></Suspense></ErrorBoundary></ProtectedRoute>} />
                      <Route path="/admin/users" element={<ProtectedRoute requiredScope="users:read"><ErrorBoundary><Suspense fallback={loader}><UsersPage /></Suspense></ErrorBoundary></ProtectedRoute>} />
                      <Route path="/admin/organizations" element={<ProtectedRoute requiredScope="organizations:read"><ErrorBoundary><Suspense fallback={loader}><OrganizationsPage /></Suspense></ErrorBoundary></ProtectedRoute>} />
                      <Route path="/admin/roles" element={<ProtectedRoute requiredScope="users:read"><ErrorBoundary><Suspense fallback={loader}><RolesPage /></Suspense></ErrorBoundary></ProtectedRoute>} />
                      <Route path="/admin/apikeys" element={<ProtectedRoute><ErrorBoundary><Suspense fallback={loader}><APIKeysPage /></Suspense></ErrorBoundary></ProtectedRoute>} />
                      <Route path="/admin/upload" element={<Navigate to="/admin/upload/module" replace />} />
                      <Route path="/admin/upload/module" element={<ProtectedRoute requiredScope="modules:write"><ErrorBoundary><Suspense fallback={loader}><ModuleUploadPage /></Suspense></ErrorBoundary></ProtectedRoute>} />
                      <Route path="/admin/upload/provider" element={<ProtectedRoute requiredScope="providers:write"><ErrorBoundary><Suspense fallback={loader}><ProviderUploadPage /></Suspense></ErrorBoundary></ProtectedRoute>} />
                      <Route path="/admin/scm-providers" element={<ProtectedRoute requiredScope="scm:read"><ErrorBoundary><Suspense fallback={loader}><SCMProvidersPage /></Suspense></ErrorBoundary></ProtectedRoute>} />
                      <Route path="/admin/mirrors" element={<ProtectedRoute requiredScope="mirrors:read"><ErrorBoundary><Suspense fallback={loader}><MirrorsPage /></Suspense></ErrorBoundary></ProtectedRoute>} />
                      <Route path="/admin/terraform-mirror" element={<ProtectedRoute requiredScope="mirrors:read"><ErrorBoundary><Suspense fallback={loader}><TerraformMirrorPage /></Suspense></ErrorBoundary></ProtectedRoute>} />
                      <Route path="/admin/storage" element={<ProtectedRoute requiredScope="admin"><ErrorBoundary><Suspense fallback={loader}><StoragePage /></Suspense></ErrorBoundary></ProtectedRoute>} />
                      <Route path="/admin/approvals" element={<ProtectedRoute requiredScope="mirrors:read"><ErrorBoundary><Suspense fallback={loader}><ApprovalsPage /></Suspense></ErrorBoundary></ProtectedRoute>} />
                      <Route path="/admin/policies" element={<ProtectedRoute requiredScope="admin"><ErrorBoundary><Suspense fallback={loader}><MirrorPoliciesPage /></Suspense></ErrorBoundary></ProtectedRoute>} />
                      <Route path="/admin/oidc" element={<ProtectedRoute requiredScope="admin"><ErrorBoundary><Suspense fallback={loader}><OIDCSettingsPage /></Suspense></ErrorBoundary></ProtectedRoute>} />
                      <Route path="/admin/scim" element={<ProtectedRoute requiredScope="admin"><ErrorBoundary><Suspense fallback={loader}><SCIMProvisioningPage /></Suspense></ErrorBoundary></ProtectedRoute>} />
                      <Route path="/admin/mtls" element={<ProtectedRoute requiredScope="admin"><ErrorBoundary><Suspense fallback={loader}><MTLSPage /></Suspense></ErrorBoundary></ProtectedRoute>} />
                      <Route path="/admin/audit-logs" element={<ProtectedRoute requiredScope="audit:read"><ErrorBoundary><Suspense fallback={loader}><AuditLogPage /></Suspense></ErrorBoundary></ProtectedRoute>} />
                      <Route path="/admin/security-scanning" element={<ProtectedRoute requiredScope="admin"><ErrorBoundary><Suspense fallback={loader}><SecurityScanningPage /></Suspense></ErrorBoundary></ProtectedRoute>} />

                      {/* Dev-only routes */}
                      {import.meta.env.DEV && (
                        <Route path="/dev/components" element={<Suspense fallback={loader}><ComponentShowcase /></Suspense>} />
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
    </ThemeProvider>
  );
}

export default App;
