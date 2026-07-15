import type React from 'react'
import { SuiteThemeProvider, useThemeMode } from '@sethbacon/terraform-suite-ui'
import apiClient from '../services/api'
import { isSafeExternalUrl } from '../utils/externalUrl'

const THEME_KEY = 'terraform-registry-theme'
const DEFAULT_PRODUCT_NAME = 'Terraform Registry'

// Defense-in-depth: the whitelabel URLs come from the backend /api/v1/ui/theme; validate each at
// the app boundary and drop any that fails, before handing them to the shared theme provider.
async function getSafeUITheme() {
  const theme = await apiClient.getUITheme()
  if (!theme) return theme
  return {
    ...theme,
    logo_url: isSafeExternalUrl(theme.logo_url) ? theme.logo_url : undefined,
    favicon_url: isSafeExternalUrl(theme.favicon_url) ? theme.favicon_url : undefined,
    login_hero_url: isSafeExternalUrl(theme.login_hero_url) ? theme.login_hero_url : undefined,
  }
}

/** Wraps the shared SuiteThemeProvider with this app's storage key + whitelabel fetch. */
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <SuiteThemeProvider
    storageKey={THEME_KEY}
    defaultProductName={DEFAULT_PRODUCT_NAME}
    getUITheme={getSafeUITheme}
  >
    {children}
  </SuiteThemeProvider>
)

export { useThemeMode }

