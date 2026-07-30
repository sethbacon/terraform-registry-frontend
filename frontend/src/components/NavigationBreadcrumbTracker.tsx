import { useNavigationBreadcrumbs } from '../hooks/useNavigationBreadcrumbs'

/**
 * Invisible component that records navigation breadcrumbs for error
 * reporting on SPA route changes. Must be rendered inside <Router>.
 */
export default function NavigationBreadcrumbTracker() {
  useNavigationBreadcrumbs()
  return null
}
