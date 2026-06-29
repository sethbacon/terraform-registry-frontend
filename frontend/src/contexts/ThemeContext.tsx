import type React from 'react'
import { SuiteThemeProvider, useThemeMode } from '@sethbacon/terraform-suite-ui'
import apiClient from '../services/api'

const THEME_KEY = 'terraform-registry-theme'
const DEFAULT_PRODUCT_NAME = 'Terraform Registry'

/** Wraps the shared SuiteThemeProvider with this app's storage key + whitelabel fetch. */
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <SuiteThemeProvider
    storageKey={THEME_KEY}
    defaultProductName={DEFAULT_PRODUCT_NAME}
    getUITheme={apiClient.getUITheme}
  >
    {children}
  </SuiteThemeProvider>
)

export { useThemeMode }

