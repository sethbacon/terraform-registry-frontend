import type { AxiosError } from 'axios'
import { captureError } from '../errorReporting'
import { http, setupRequest } from './http'
import type { UIThemeConfig } from '../../types'

// ============================================================================
// UI Theme (whitelabel)
// ============================================================================

/**
 * Fetch the runtime whitelabel theme config from the backend.
 * Returns null if the endpoint does not exist (pre-phase-5 backends) so
 * callers can gracefully fall back to built-in defaults. Other failures
 * (network errors, 5xx, auth) also fall back to defaults -- theming must
 * never block the app -- but are reported via captureError instead of
 * being silently treated as "no override".
 */
export async function getUITheme(): Promise<UIThemeConfig | null> {
  try {
    const response = await http.get<UIThemeConfig>('/api/v1/ui/theme')
    return response.data
  } catch (error) {
    if ((error as AxiosError)?.response?.status === 404) {
      return null
    }
    captureError(error instanceof Error ? error : new Error(String(error)), {
      endpoint: '/api/v1/ui/theme',
    })
    return null
  }
}

export async function updateAdminUITheme(config: UIThemeConfig): Promise<UIThemeConfig> {
  const response = await http.put<UIThemeConfig>('/api/v1/admin/ui-theme', config)
  return response.data
}

/**
 * Setup-wizard write path. Authenticated by the one-time setup token (not
 * admin scope), so BrandingStep can persist branding before any user is
 * configured. Backed by PUT /api/v1/setup/ui-theme on the backend.
 */
export async function saveSetupUITheme(
  setupToken: string,
  config: UIThemeConfig,
): Promise<UIThemeConfig> {
  const response = await http.put<UIThemeConfig>(
    '/api/v1/setup/ui-theme',
    config,
    setupRequest(setupToken),
  )
  return response.data
}
