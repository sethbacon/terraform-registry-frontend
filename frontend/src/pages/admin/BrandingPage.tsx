import React from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert } from '@mui/material'
import { BrandingSettingsCard, type UIThemeConfig } from '../../suite'
import PageTitleIcon from '@mui/icons-material/Palette'
import Page from '../../components/Page'
import PageHeader from '../../components/PageHeader'
import api from '../../services/api'
import { queryKeys } from '../../services/queryKeys'
import { useAuth } from '../../contexts/AuthContext'
import { getErrorMessage } from '../../utils/errors'
import { isSafeExternalUrl } from '../../utils/externalUrl'
import { isValidBrandingColor } from '../../utils/brandingValidators'

/**
 * Admin whitelabel branding, persisted via PUT /api/v1/admin/ui-theme and
 * served publicly at GET /api/v1/ui/theme. The theme provider reads that
 * endpoint at app start, so a saved change applies on the next full reload.
 *
 * The setup wizard's BrandingStep writes the same config through a
 * setup-token-authenticated route; this page is the post-setup equivalent.
 */
const BrandingPage: React.FC = () => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { allowedScopes } = useAuth()
  const canManage = allowedScopes.includes('admin')

  // getAdminUITheme, not getUITheme: the latter swallows every failure into
  // null, which here would render a blank form indistinguishable from "nothing
  // configured" and let the next Save wipe the stored branding.
  const themeQuery = useQuery({
    queryKey: queryKeys.ui.theme(),
    queryFn: () => api.getAdminUITheme(),
  })

  const saveMutation = useMutation({
    mutationFn: (config: UIThemeConfig) => api.updateAdminUITheme(config),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.ui.theme() }),
  })

  return (
    <Page maxWidth="lg">
      <PageHeader
        icon={<PageTitleIcon />}
        title={t('admin.branding.pageTitle')}
        description={t('admin.branding.pageSubtitle')}
      />
      {themeQuery.isError ? (
        <Alert severity="error">{t('admin.branding.loadError')}</Alert>
      ) : (
        <BrandingSettingsCard
          value={themeQuery.data ?? {}}
          isLoading={themeQuery.isLoading}
          canManage={canManage}
          validators={{ isValidColor: isValidBrandingColor, isValidUrl: isSafeExternalUrl }}
          strings={{
            fields: {
              product_name: {
                label: t('admin.branding.productName'),
                errorText: t('admin.branding.productNameHelp'),
              },
              primary_color: {
                label: t('admin.branding.primaryColor'),
                errorText: t('admin.branding.colorHelp'),
              },
              secondary_color_light: {
                label: t('admin.branding.secondaryColorLight'),
                errorText: t('admin.branding.colorHelp'),
              },
              secondary_color_dark: {
                label: t('admin.branding.secondaryColorDark'),
                errorText: t('admin.branding.colorHelp'),
              },
              logo_url: {
                label: t('admin.branding.logoUrl'),
                errorText: t('admin.branding.urlHelp'),
              },
              favicon_url: {
                label: t('admin.branding.faviconUrl'),
                errorText: t('admin.branding.urlHelp'),
              },
              login_hero_url: {
                label: t('admin.branding.loginHeroUrl'),
                errorText: t('admin.branding.urlHelp'),
              },
            },
            resetDefaults: t('admin.branding.resetDefaults'),
            savedReloadHint: t('admin.branding.savedReloadHint'),
            reloadNow: t('admin.branding.reloadNow'),
          }}
          onSave={async (config) => {
            // The card renders Error.message, and an AxiosError's own message is
            // just "Request failed with status code 400". Route through
            // getErrorMessage so the backend's validation detail survives and is
            // scrubbed of anything internal before it reaches the page.
            try {
              await saveMutation.mutateAsync(config)
            } catch (e) {
              throw new Error(getErrorMessage(e, t('admin.branding.saveError')))
            }
          }}
        />
      )}
    </Page>
  )
}

export default BrandingPage
