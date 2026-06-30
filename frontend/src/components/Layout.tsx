import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { IconButton, ListItemIcon, Menu, MenuItem, Tooltip } from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import HelpOutline from '@mui/icons-material/HelpOutlined'
import InfoOutlined from '@mui/icons-material/InfoOutlined'
import { SuiteLayout } from '@sethbacon/terraform-suite-ui'
import { useAuth } from '../contexts/AuthContext'
import { useHelp } from '../contexts/HelpContext'
import { useHotkey } from '../hooks/useHotkey'
import {
  homeItem,
  primaryNavItems,
  componentShowcaseItem,
  adminNavGroups,
} from '../navigation'
import DevUserSwitcher from './DevUserSwitcher'
import { SuiteSwitcher } from './SuiteSwitcher'
import HelpPanel, { HELP_PANEL_WIDTH } from './HelpPanel'
import AboutModal from './AboutModal'
import AdminBreadcrumbs from './AdminBreadcrumbs'
import CommandPalette from './CommandPalette'
import AdvisoryBanner from './AdvisoryBanner'

// Native names are intentionally hardcoded (not translated) so each language is
// always shown in its own script, making the picker usable even when the active
// locale is one the user does not read.
const LANGUAGE_NATIVE_NAMES = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  ja: '日本語',
  pt: 'Português',
  nl: 'Nederlands',
  nb: 'Norsk bokmål',
  zh: '简体中文',
  it: 'Italiano',
} as const

const LANGUAGES = Object.entries(LANGUAGE_NATIVE_NAMES).map(([code, label]) => ({ code, label }))

/**
 * Application shell. A thin wrapper over the shared SuiteLayout that injects the
 * registry's navigation, the combined Settings (theme + language) menu, a Support
 * menu (context help + about), the command palette, the advisory banner + admin
 * breadcrumbs, and the route-aware help panel. The AppBar (incl. whitelabel logo
 * brand), drawer, active-nav styling, account menu, skip link, lazy-route
 * Suspense boundary, and session-expiry warning all come from SuiteLayout.
 */
const Layout = () => {
  const { t } = useTranslation()
  const { isAuthenticated } = useAuth()
  const { helpOpen, openHelp } = useHelp()

  const [aboutOpen, setAboutOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [supportAnchorEl, setSupportAnchorEl] = useState<null | HTMLElement>(null)

  useHotkey(
    'mod+k',
    useCallback(() => setPaletteOpen((v) => !v), []),
  )

  // The dev-only Component Showcase sits at the end of the flat public nav.
  const primary = import.meta.env.DEV ? [...primaryNavItems, componentShowcaseItem] : primaryNavItems

  return (
    <>
      <SuiteLayout
        homeItem={homeItem}
        primaryNavItems={primary}
        // The admin section is gated on authentication (its API-keys item is
        // scope-less, so without this it would show to anonymous visitors).
        navGroups={isAuthenticated ? adminNavGroups : []}
        groupStateStorageKey="adminNavGroups"
        suiteSwitcher={isAuthenticated ? <SuiteSwitcher /> : undefined}
        settingsMenu
        languages={LANGUAGES}
        maxWidth={false}
        contentHeader={
          <>
            <AdvisoryBanner />
            <AdminBreadcrumbs />
          </>
        }
        contentInsetRight={helpOpen ? HELP_PANEL_WIDTH : 0}
        appBarActions={
          <>
            {isAuthenticated && <DevUserSwitcher />}
            <Tooltip title={t('header.quickNav')}>
              <IconButton
                color="inherit"
                onClick={() => setPaletteOpen(true)}
                aria-label={t('header.openCommandPalette')}
              >
                <SearchIcon />
              </IconButton>
            </Tooltip>
          </>
        }
        supportMenu={
          <>
            <Tooltip title={t('header.support')}>
              <IconButton
                color="inherit"
                onClick={(e) => setSupportAnchorEl(e.currentTarget)}
                aria-label={t('header.support')}
                aria-haspopup="true"
                aria-controls={supportAnchorEl ? 'support-menu' : undefined}
              >
                <HelpOutline />
              </IconButton>
            </Tooltip>
            <Menu
              id="support-menu"
              anchorEl={supportAnchorEl}
              open={Boolean(supportAnchorEl)}
              onClose={() => setSupportAnchorEl(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
              <MenuItem
                onClick={() => {
                  setSupportAnchorEl(null)
                  openHelp()
                }}
              >
                <ListItemIcon>
                  <HelpOutline fontSize="small" />
                </ListItemIcon>
                {t('header.contextHelp')}
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setSupportAnchorEl(null)
                  setAboutOpen(true)
                }}
              >
                <ListItemIcon>
                  <InfoOutlined fontSize="small" />
                </ListItemIcon>
                {t('header.about')}
              </MenuItem>
            </Menu>
          </>
        }
        commandPalette={<CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />}
      />
      <HelpPanel />
      <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </>
  )
}

export default Layout
