import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import PageHeader from '../components/PageHeader'
import PageTitleIcon from '@mui/icons-material/Description'
import SwaggerUI from 'swagger-ui-react'
import 'swagger-ui-react/swagger-ui.css'
import { Box, Typography, List, ListItem, ListItemButton, ListItemText, Paper } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { enforceSwaggerA11yStyles, getSwaggerThemeCss } from '../utils/swaggerTheme'
import { getCookie } from '../services/api/http'

// swagger-ui-react's wrapper only forwards a fixed set of props to the
// underlying SwaggerUIBundle.  tagsSorter is not one of them, so we inject
// it via a plugin that wraps the taggedOperations selector to always sort.
/* eslint-disable @typescript-eslint/no-explicit-any -- SwaggerUI plugin & Immutable.js types are untyped */
const TagsSorterPlugin = (): any => ({
  statePlugins: {
    spec: {
      wrapSelectors: {
        taggedOperations:
          (origSelector: any) =>
            (...args: any[]) => {
              const taggedOps = origSelector(...args)
              if (taggedOps && typeof taggedOps.sortBy === 'function') {
                return taggedOps.sortBy(
                  (_val: any, key: string) => key,
                  (a: string, b: string) => a.localeCompare(b),
                )
              }
              return taggedOps
            },
      },
    },
  },
})
/* eslint-enable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Left nav — reads tags from the rendered DOM and tracks active section
// ---------------------------------------------------------------------------

interface NavTag {
  id: string // the CSS id Swagger UI assigns, e.g. "operations-tag-Providers"
  label: string
}

interface OpenAPISpec {
  paths?: Record<string, Record<string, { tags?: string[] }>>
}

function buildNavTags(spec: OpenAPISpec): NavTag[] {
  if (!spec?.paths) return []
  const seen = new Set<string>()
  const tags: NavTag[] = []
  for (const methods of Object.values(spec.paths)) {
    for (const op of Object.values(methods)) {
      if (!op?.tags) continue
      for (const tag of op.tags) {
        if (!seen.has(tag)) {
          seen.add(tag)
          // Swagger UI encodes spaces as underscores in tag section ids
          tags.push({ id: `operations-tag-${tag.replace(/\s+/g, '_')}`, label: tag })
        }
      }
    }
  }
  tags.sort((a, b) => a.label.localeCompare(b.label))
  return tags
}

const NAV_WIDTH = 200

const ApiDocumentation: React.FC = () => {
  const { t } = useTranslation()
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'

  // CSP nonce injected by nginx into <meta name="csp-nonce">. The override
  // <style> below MUST carry it; otherwise the strict `style-src 'self'
  // 'nonce-...'` policy blocks the element and strips every Swagger UI theme
  // override (leaving the bundled light theme). Mirrors the emotion cache nonce
  // setup in main.tsx; resolves to undefined in dev/tests where no nonce exists.
  const cspNonce = useMemo(() => {
    const n = document.querySelector('meta[name="csp-nonce"]')?.getAttribute('content')
    return n && n !== '__CSP_NONCE__' ? n : undefined
  }, [])

  const [navTags, setNavTags] = useState<NavTag[]>([])
  const [activeTag, setActiveTag] = useState<string>('')
  const specRef = useRef<OpenAPISpec | null>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const mutationObserverRef = useRef<MutationObserver | null>(null)

  // "Try it out" auth rides on the HttpOnly session cookie (same-origin fetch
  // sends it automatically) — no Authorization header is attached client-side.
  // Echo the non-HttpOnly tfr_csrf cookie as X-CSRF-Token on mutating methods
  // so those requests pass the double-submit CSRF middleware (mirrors the axios
  // interceptor in services/api/http.ts).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- swagger-ui-react's Request type lacks headers
  const requestInterceptor = useCallback((req: any) => {
    const method = String(req.method || 'GET').toUpperCase()
    if (method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE') {
      const csrfToken = getCookie('tfr_csrf')
      if (csrfToken) req.headers['X-CSRF-Token'] = csrfToken
    }
    return req
  }, [])

  // onComplete fires when SwaggerUI finishes rendering.
  // We extract tags from the loaded spec at that point.
  const onComplete = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- swagger-ui-react system type is not exported
    (system: any) => {
      try {
        const spec = system.getState().toJS().spec?.json
        if (spec) {
          specRef.current = spec
          setNavTags(buildNavTags(spec))
        }
      } catch {
        // spec not available yet — harmless
      }

      // a11y fix: enforce WCAG-compliant styles after Swagger UI renders.
      // Small delay to allow Swagger UI to finish its own DOM mutations.
      setTimeout(() => enforceSwaggerA11yStyles(isDark), 300)
    },
    [isDark],
  )

  // Set up an IntersectionObserver to track which tag section is visible.
  useEffect(() => {
    if (!navTags.length) return

    observerRef.current?.disconnect()

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the topmost visible section
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible.length > 0) {
          setActiveTag(visible[0].target.id)
        }
      },
      { rootMargin: '-10% 0px -70% 0px', threshold: 0 },
    )

    // Small delay to allow Swagger UI to finish rendering its DOM
    const timer = setTimeout(() => {
      navTags.forEach(({ id }) => {
        const el = document.getElementById(id)
        if (el) observer.observe(el)
      })
    }, 300)

    observerRef.current = observer
    return () => {
      clearTimeout(timer)
      observer.disconnect()
    }
  }, [navTags])

  // MutationObserver: re-enforce a11y styles whenever Swagger UI mutates its DOM
  // (e.g. user expands/collapses an operation, switches tabs, etc.)
  useEffect(() => {
    const container = contentRef.current
    if (!container) return

    let debounceTimer: ReturnType<typeof setTimeout>
    const mo = new MutationObserver(() => {
      clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => enforceSwaggerA11yStyles(isDark), 100)
    })

    mo.observe(container, { childList: true, subtree: true })
    mutationObserverRef.current = mo

    return () => {
      clearTimeout(debounceTimer)
      mo.disconnect()
      mutationObserverRef.current = null
    }
  }, [isDark])

  const scrollToTag = useCallback((id: string) => {
    const el = document.getElementById(id)
    if (!el) return
    // Offset for the fixed AppBar (~64px) plus a little breathing room
    const y = el.getBoundingClientRect().top + window.scrollY - 80
    window.scrollTo({ top: y, behavior: 'smooth' })
    setActiveTag(id)
  }, [])

  const primaryColor = theme.palette.primary.main
  const navBg = isDark ? '#1e1e1e' : '#fafafa'
  const navBorder = isDark ? '#333' : '#e0e0e0'
  const navText = isDark ? '#ccc' : '#555'
  const activeText = primaryColor
  const activeBg = isDark ? `${primaryColor}26` : `${primaryColor}14`

  return (
    <Box sx={{ overflow: 'hidden' }}>
      {/* Page title */}
      <PageHeader icon={<PageTitleIcon />} title={t('apiDocumentation.title')} description={t('apiDocumentation.subtitle')} />
      {/* Layout: sticky left nav + Swagger UI content */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0 }}>
        {/* ---- Left navigation panel ---- */}
        {navTags.length > 0 && (
          <Box
            sx={{
              width: NAV_WIDTH,
              flexShrink: 0,
              position: 'sticky',
              top: 80, // below the fixed AppBar
              maxHeight: 'calc(100vh - 100px)',
              overflowY: 'auto',
              mr: 2,
            }}
          >
            <Paper
              elevation={0}
              sx={{
                background: navBg,
                border: `1px solid ${navBorder}`,
                borderRadius: 2,
                overflow: 'hidden',
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  display: 'block',
                  px: 2,
                  pt: 1.5,
                  pb: 0.5,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: isDark ? '#aaa' : '#666',
                  fontSize: '0.68rem',
                }}
              >
                Sections
              </Typography>
              <List dense disablePadding>
                {navTags.map(({ id, label }) => {
                  const isActive = activeTag === id
                  return (
                    <ListItem key={id} disablePadding>
                      <ListItemButton
                        onClick={() => scrollToTag(id)}
                        sx={{
                          py: 0.5,
                          px: 2,
                          borderLeft: isActive
                            ? `3px solid ${primaryColor}`
                            : '3px solid transparent',
                          background: isActive ? activeBg : 'transparent',
                          borderRadius: 0,
                          '&:hover': {
                            background: isDark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.04)',
                          },
                        }}
                      >
                        <ListItemText
                          primary={label}
                          slotProps={{
                            primary: {
                              sx: {
                                fontSize: '0.78rem',
                                fontWeight: isActive ? 600 : 400,
                                color: isActive ? activeText : navText,
                                lineHeight: 1.4,
                              },
                            },
                          }}
                        />
                      </ListItemButton>
                    </ListItem>
                  )
                })}
              </List>
            </Paper>
          </Box>
        )}

        {/* ---- Swagger UI content ---- */}
        <Box ref={contentRef} sx={{ flex: 1, minWidth: 0 }}>
          <style nonce={cspNonce}>{getSwaggerThemeCss(isDark)}</style>

          <SwaggerUI
            url="/swagger.json"
            docExpansion="list"
            deepLinking
            tryItOutEnabled
            requestInterceptor={requestInterceptor}
            onComplete={onComplete}
            plugins={[TagsSorterPlugin]}
          />
        </Box>
      </Box>
    </Box>
  )
}

export default ApiDocumentation
