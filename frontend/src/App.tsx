import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { CssBaseline } from '@mui/material';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import { HelpProvider } from './contexts/HelpContext';
import Layout from './components/Layout';
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
const AuditLogPage = lazy(() => import('./pages/admin/AuditLogPage'));

const loader = <div>Loading...</div>;

function App() {
  return (
    <ThemeProvider>
      <CssBaseline />
      <AuthProvider>
        <HelpProvider>
          <Router>
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
                <Route path="/modules/:namespace/:name/:system" element={<Suspense fallback={loader}><ModuleDetailPage /></Suspense>} />

                {/* Providers */}
                <Route path="/providers" element={<ProvidersPage />} />
                <Route path="/providers/:namespace/:type" element={<Suspense fallback={loader}><ProviderDetailPage /></Suspense>} />

                {/* Terraform Binaries */}
                <Route path="/terraform-binaries" element={<TerraformBinariesPage />} />
                <Route path="/terraform-binaries/:name" element={<Suspense fallback={loader}><TerraformBinaryDetailPage /></Suspense>} />

                {/* API Documentation */}
                <Route path="/api-docs" element={<Suspense fallback={loader}><ApiDocumentation /></Suspense>} />

                {/* Admin routes (protected with scope requirements) */}
                <Route path="/admin" element={<ProtectedRoute><Suspense fallback={loader}><DashboardPage /></Suspense></ProtectedRoute>} />
                <Route path="/admin/users" element={<ProtectedRoute requiredScope="users:read"><Suspense fallback={loader}><UsersPage /></Suspense></ProtectedRoute>} />
                <Route path="/admin/organizations" element={<ProtectedRoute requiredScope="organizations:read"><Suspense fallback={loader}><OrganizationsPage /></Suspense></ProtectedRoute>} />
                <Route path="/admin/roles" element={<ProtectedRoute requiredScope="users:read"><Suspense fallback={loader}><RolesPage /></Suspense></ProtectedRoute>} />
                <Route path="/admin/apikeys" element={<ProtectedRoute><Suspense fallback={loader}><APIKeysPage /></Suspense></ProtectedRoute>} />
                <Route path="/admin/upload" element={<Navigate to="/admin/upload/module" replace />} />
                <Route path="/admin/upload/module" element={<ProtectedRoute requiredScope="modules:write"><Suspense fallback={loader}><ModuleUploadPage /></Suspense></ProtectedRoute>} />
                <Route path="/admin/upload/provider" element={<ProtectedRoute requiredScope="providers:write"><Suspense fallback={loader}><ProviderUploadPage /></Suspense></ProtectedRoute>} />
                <Route path="/admin/scm-providers" element={<ProtectedRoute requiredScope="scm:read"><Suspense fallback={loader}><SCMProvidersPage /></Suspense></ProtectedRoute>} />
                <Route path="/admin/mirrors" element={<ProtectedRoute requiredScope="mirrors:read"><Suspense fallback={loader}><MirrorsPage /></Suspense></ProtectedRoute>} />
                <Route path="/admin/terraform-mirror" element={<ProtectedRoute requiredScope="mirrors:read"><Suspense fallback={loader}><TerraformMirrorPage /></Suspense></ProtectedRoute>} />
                <Route path="/admin/storage" element={<ProtectedRoute requiredScope="admin"><Suspense fallback={loader}><StoragePage /></Suspense></ProtectedRoute>} />
                <Route path="/admin/approvals" element={<ProtectedRoute requiredScope="mirrors:read"><Suspense fallback={loader}><ApprovalsPage /></Suspense></ProtectedRoute>} />
                <Route path="/admin/policies" element={<ProtectedRoute requiredScope="admin"><Suspense fallback={loader}><MirrorPoliciesPage /></Suspense></ProtectedRoute>} />
                <Route path="/admin/oidc" element={<ProtectedRoute requiredScope="admin"><Suspense fallback={loader}><OIDCSettingsPage /></Suspense></ProtectedRoute>} />
                <Route path="/admin/audit-logs" element={<ProtectedRoute requiredScope="audit:read"><Suspense fallback={loader}><AuditLogPage /></Suspense></ProtectedRoute>} />

                {/* Catch all */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </Router>
        </HelpProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
