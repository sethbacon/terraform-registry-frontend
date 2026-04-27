import React, { createContext, useContext, useState, useEffect, useMemo } from 'react'
import { ThemeProvider as MuiThemeProvider, createTheme, PaletteMode } from '@mui/material'
import type { UIThemeConfig } from '../types'
import apiClient from '../services/api'
import i18n from '../i18n'

const DEFAULT_PRIMARY = '#5C4EE5'
const DEFAULT_SECONDARY_LIGHT = '#00796B'
const DEFAULT_SECONDARY_DARK = '#00D9C0'
const DEFAULT_PRODUCT_NAME = 'Terraform Registry'

// Languages that use right-to-left text direction.
const RTL_LANGUAGES = new Set(['ar', 'he', 'fa', 'ur', 'yi'])

function getDirection(lang: string): 'ltr' | 'rtl' {
  return RTL_LANGUAGES.has(lang.split('-')[0]) ? 'rtl' : 'ltr'
}

interface ThemeContextType {
  mode: PaletteMode
  toggleTheme: () => void
  /** Display name for the registry, from the whitelabel config or the built-in default. */
  productName: string
  /** Logo image URL, or null if no custom logo is configured. */
  logoUrl: string | null
  /** Login-page hero image URL, or null if not configured. */
  loginHeroUrl: string | null
  /** Current text direction derived from the active language. */
  direction: 'ltr' | 'rtl'
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

const THEME_KEY = 'terraform-registry-theme'

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<PaletteMode>(() => {
    // Check localStorage first
    const savedTheme = localStorage.getItem(THEME_KEY)
    if (savedTheme === 'dark' || savedTheme === 'light') {
      return savedTheme
    }
    // Fall back to system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark'
    }
    return 'light'
  })

  const [uiTheme, setUiTheme] = useState<UIThemeConfig | null>(null)

  // Direction tracks the text direction of the current i18n language.
  const [direction, setDirection] = useState<'ltr' | 'rtl'>(() =>
    getDirection(i18n.language ?? 'en'),
  )

  useEffect(() => {
    localStorage.setItem(THEME_KEY, mode)
  }, [mode])

  // Sync direction when i18n language changes, and update <html dir="…">.
  useEffect(() => {
    const handleLanguageChanged = (lng: string) => {
      const dir = getDirection(lng)
      setDirection(dir)
      document.documentElement.dir = dir
      document.documentElement.lang = lng
    }
    // Apply immediately on mount in case language was already set.
    handleLanguageChanged(i18n.language ?? 'en')
    i18n.on('languageChanged', handleLanguageChanged)
    return () => {
      i18n.off('languageChanged', handleLanguageChanged)
    }
  }, [])

  // Fetch whitelabel theme config once on mount.
  useEffect(() => {
    apiClient
      .getUITheme()
      .then((config) => {
        if (config) {
          setUiTheme(config)
          // Apply favicon override if provided.
          if (config.favicon_url) {
            const link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]')
            if (link) {
              link.href = config.favicon_url
            }
          }
        }
      })
      .catch(() => {
        // Silently ignore errors — fallback to defaults.
      })
  }, [])

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (e: MediaQueryListEvent) => {
      // Only auto-switch if user hasn't set a preference
      const savedTheme = localStorage.getItem(THEME_KEY)
      if (!savedTheme) {
        setMode(e.matches ? 'dark' : 'light')
      }
    }
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  const toggleTheme = () => {
    setMode((prevMode) => (prevMode === 'light' ? 'dark' : 'light'))
  }

  const primaryColor = uiTheme?.primary_color ?? DEFAULT_PRIMARY
  const secondaryLight = uiTheme?.secondary_color_light ?? DEFAULT_SECONDARY_LIGHT
  const secondaryDark = uiTheme?.secondary_color_dark ?? DEFAULT_SECONDARY_DARK

  const theme = useMemo(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

    return createTheme({
      direction,
      palette: {
        mode,
        primary: {
          main: primaryColor,
        },
        secondary: {
          main: mode === 'light' ? secondaryLight : secondaryDark,
        },
        ...(mode === 'dark' && {
          background: {
            default: '#121212',
            paper: '#1e1e1e',
          },
        }),
      },
      typography: {
        fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
      },
      transitions: prefersReducedMotion
        ? {
            // Disable all MUI transitions when reduced motion is preferred
            create: () => 'none',
            duration: {
              shortest: 0,
              shorter: 0,
              short: 0,
              standard: 0,
              complex: 0,
              enteringScreen: 0,
              leavingScreen: 0,
            },
          }
        : undefined,
      components: {
        MuiCssBaseline: {
          styleOverrides: {
            ':root': {
              // CSS custom properties so non-MUI elements can reference brand colours.
              '--brand-primary': primaryColor,
              '--brand-secondary': mode === 'light' ? secondaryLight : secondaryDark,
            },
            body: {
              scrollbarColor: mode === 'dark' ? '#6b6b6b #2b2b2b' : undefined,
              '&::-webkit-scrollbar, & *::-webkit-scrollbar': {
                backgroundColor: mode === 'dark' ? '#2b2b2b' : undefined,
              },
              '&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb': {
                backgroundColor: mode === 'dark' ? '#6b6b6b' : undefined,
                borderRadius: 8,
              },
            },
            // Global code block styling for dark mode compatibility
            'pre, code': {
              backgroundColor: mode === 'dark' ? '#2d2d2d' : '#f5f5f5',
              color: mode === 'dark' ? '#e6e6e6' : '#1e1e1e',
            },
          },
        },
      },
    })
  }, [mode, primaryColor, secondaryLight, secondaryDark, direction])

  const contextValue = useMemo<ThemeContextType>(
    () => ({
      mode,
      toggleTheme,
      productName: uiTheme?.product_name ?? DEFAULT_PRODUCT_NAME,
      logoUrl: uiTheme?.logo_url ?? null,
      loginHeroUrl: uiTheme?.login_hero_url ?? null,
      direction,
    }),
    [mode, uiTheme, direction],
  )

  return (
    <ThemeContext.Provider value={contextValue}>
      <MuiThemeProvider theme={theme}>{children}</MuiThemeProvider>
    </ThemeContext.Provider>
  )
}

export const useThemeMode = () => {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useThemeMode must be used within a ThemeProvider')
  }
  return context
}
