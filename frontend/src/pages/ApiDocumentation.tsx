import React, { useCallback, useEffect, useRef, useState } from 'react';
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';
import { Box, Typography, List, ListItemButton, ListItemText, Paper } from '@mui/material';
import { useTheme } from '@mui/material/styles';

// ---------------------------------------------------------------------------
// Theme-aligned CSS overrides for Swagger UI
//
// Goals:
//   1. Match the app's Inter font and neutral palette (no default cyan/orange)
//   2. Use the app's #5C4EE5 primary everywhere Swagger UI uses its blue
//   3. Keep method-badge colors readable but desaturated to reduce visual noise
//   4. Full dark-mode support matching the app's #121212 / #1e1e1e surfaces
// ---------------------------------------------------------------------------

const BASE_CSS = `
  /* ---------- typography ---------- */
  .swagger-ui,
  .swagger-ui *,
  .swagger-ui input,
  .swagger-ui select,
  .swagger-ui textarea,
  .swagger-ui button {
    font-family: "Inter", "Roboto", "Helvetica", "Arial", sans-serif !important;
  }

  /* ---------- hide default top bar ---------- */
  .swagger-ui .topbar { display: none; }

  /* ---------- hide the info header block (we render our own) ---------- */
  .swagger-ui .information-container { display: none; }

  /* ---------- scheme selector — sticky below AppBar ---------- */
  .swagger-ui .scheme-container {
    box-shadow: none;
    padding: 12px 0;
    position: sticky;
    top: 64px;
    z-index: 50;
  }

  /* Make the scheme <select> look clearly like a dropdown */
  .swagger-ui .scheme-container select {
    appearance: auto !important;
    -webkit-appearance: auto !important;
    cursor: pointer;
    padding: 5px 10px;
    font-weight: 500;
    font-size: 0.875rem;
    min-width: 90px;
    border-radius: 4px;
    border-width: 1.5px !important;
  }

  /* ---------- section tags (group headers) ---------- */
  .swagger-ui .opblock-tag {
    font-size: 0.9rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  /* ---------- execute button uses app primary ---------- */
  .swagger-ui .btn.execute {
    background: #5C4EE5;
    border-color: #5C4EE5;
    color: #fff;
  }
  .swagger-ui .btn.execute:hover {
    background: #4a3dd4;
    border-color: #4a3dd4;
  }

  /* ---------- try-out / cancel buttons ---------- */
  .swagger-ui .btn.try-out__btn {
    border-color: #5C4EE5;
    color: #5C4EE5;
  }
  .swagger-ui .btn.try-out__btn.cancel {
    border-color: #e53935;
    color: #e53935;
  }

  /* ---------- links ---------- */
  .swagger-ui a,
  .swagger-ui .info a { color: #5C4EE5; }
  .swagger-ui a:hover,
  .swagger-ui .info a:hover { color: #4a3dd4; }

  /* ---------- method badge colours (toned down) ---------- */
  .swagger-ui .opblock.opblock-get    { background: rgba(92,78,229,.06); border-color: rgba(92,78,229,.4); }
  .swagger-ui .opblock.opblock-post   { background: rgba(0,180,120,.07); border-color: rgba(0,160,100,.5); }
  .swagger-ui .opblock.opblock-put    { background: rgba(230,150,30,.07); border-color: rgba(210,140,30,.5); }
  .swagger-ui .opblock.opblock-delete { background: rgba(210,50,50,.07); border-color: rgba(190,50,50,.5); }
  .swagger-ui .opblock.opblock-patch  { background: rgba(0,160,200,.07); border-color: rgba(0,140,180,.5); }

  .swagger-ui .opblock.opblock-get    .opblock-summary-method { background: #5C4EE5; }
  .swagger-ui .opblock.opblock-post   .opblock-summary-method { background: #00875a; }
  .swagger-ui .opblock.opblock-put    .opblock-summary-method { background: #c47e00; }
  .swagger-ui .opblock.opblock-delete .opblock-summary-method { background: #c0392b; }
  .swagger-ui .opblock.opblock-patch  .opblock-summary-method { background: #0a7fa0; }

  /* ---------- response code pills ---------- */
  .swagger-ui .response-col_status { font-weight: 600; }

  /* remove the very wide left margin swagger-ui adds by default */
  .swagger-ui .wrapper { padding: 0; }
`;

const LIGHT_EXTRA = `
  .swagger-ui .scheme-container { background: #fafafa; border-bottom: 1px solid #e0e0e0; }
  .swagger-ui .scheme-container select { border-color: #5C4EE5 !important; }
  .swagger-ui .opblock-tag { border-bottom: 1px solid #e8e8e8; color: #333; }
  .swagger-ui .opblock-tag a,
  .swagger-ui .opblock-tag .nostyle span { color: #333 !important; }
  .swagger-ui .opblock-summary-description { color: #555 !important; }
  .swagger-ui label,
  .swagger-ui .parameter__name,
  .swagger-ui .parameter__type,
  .swagger-ui table thead tr th,
  .swagger-ui .response-col_status,
  .swagger-ui .col_header { color: #333 !important; }
  .swagger-ui .parameter__in { color: #777; }
  .swagger-ui input[type=text],
  .swagger-ui textarea,
  .swagger-ui select {
    background: #fff;
    border: 1px solid #ccc;
    color: #333;
  }
  .swagger-ui .btn { border-color: #ccc; color: #444; }
  .swagger-ui .btn:hover { background: #f5f5f5; }
  .swagger-ui .responses-inner,
  .swagger-ui .response-body pre,
  .swagger-ui .highlight-code { background: #f5f5f5 !important; color: #1e1e1e !important; }

  /* curl / request snippet box — light bg, dark base text, keep inline syntax colours */
  .swagger-ui .curl-command,
  .swagger-ui .curl,
  .swagger-ui .microlight { background: #f0f0f0 !important; color: #1e1e1e !important; }
  /* microlight inlines pale colours designed for dark bg — override to richer versions */
  .swagger-ui .microlight span { filter: brightness(0.45) saturate(1.6); }

  .swagger-ui .model-box,
  .swagger-ui section.models .model-container { background: #f9f9f9; border-color: #e0e0e0; }
  .swagger-ui section.models { border-color: #e0e0e0; background: #fff; }
  .swagger-ui .tab li { color: #666; }
  .swagger-ui .markdown p,
  .swagger-ui .markdown li { color: #444; }
`;

const DARK_EXTRA = `
  .swagger-ui,
  .swagger-ui .info,
  .swagger-ui .scheme-container,
  .swagger-ui section.models,
  .swagger-ui .opblock-tag-section { background: #1e1e1e; }

  .swagger-ui .scheme-container { border-bottom: 1px solid #333; }
  .swagger-ui .scheme-container select { color-scheme: dark; border-color: #5C4EE5 !important; }
  .swagger-ui .opblock-tag { border-bottom: 1px solid #333; color: #e0e0e0; }
  .swagger-ui .opblock-tag a,
  .swagger-ui .opblock-tag .nostyle span { color: #e0e0e0 !important; }

  .swagger-ui .opblock { border-color: #444 !important; background-color: #1a1a1a !important; }
  .swagger-ui .opblock .opblock-section-header {
    background: #252525;
    border-bottom: 1px solid #333;
  }
  .swagger-ui .opblock-summary-description { color: #aaa !important; }

  .swagger-ui label,
  .swagger-ui .parameter__name,
  .swagger-ui .parameter__type,
  .swagger-ui table thead tr th,
  .swagger-ui .response-col_status,
  .swagger-ui .col_header,
  .swagger-ui .response-col_description { color: #e0e0e0 !important; }

  .swagger-ui .parameter__in { color: #999; }

  .swagger-ui input[type=text],
  .swagger-ui textarea,
  .swagger-ui select {
    background: #2d2d2d;
    border: 1px solid #555;
    color: #e0e0e0;
  }
  .swagger-ui select { background-image: none; }

  .swagger-ui .btn { border-color: #555; color: #ddd; background: transparent; }
  .swagger-ui .btn:hover { background: #2d2d2d; }

  .swagger-ui .responses-inner,
  .swagger-ui .response-body pre,
  .swagger-ui .highlight-code,
  .swagger-ui .microlight { background: #111 !important; color: #e0e0e0 !important; }

  /* curl / request snippet box */
  .swagger-ui .curl-command,
  .swagger-ui .curl { background: #111 !important; }
  .swagger-ui .curl-command *,
  .swagger-ui .curl * { color: #e0e0e0 !important; }

  .swagger-ui .model-box,
  .swagger-ui section.models .model-container { background: #1a1a1a; border-color: #333; }
  .swagger-ui section.models { border-color: #333; background: #1e1e1e; }
  .swagger-ui .model .property.primitive { color: #9ecbf0; }

  .swagger-ui .tab li { color: #aaa; }
  .swagger-ui .tab li.active { color: #e0e0e0; }
  .swagger-ui .markdown p,
  .swagger-ui .markdown li { color: #bbb; }
  .swagger-ui table.model tr.description td { color: #bbb; }

  .swagger-ui .info p,
  .swagger-ui .info li { color: #ccc; }
`;

// ---------------------------------------------------------------------------
// Left nav — reads tags from the rendered DOM and tracks active section
// ---------------------------------------------------------------------------

interface NavTag {
  id: string;   // the CSS id Swagger UI assigns, e.g. "operations-tag-Providers"
  label: string;
}

interface OpenAPISpec {
  paths?: Record<string, Record<string, { tags?: string[] }>>;
}

function buildNavTags(spec: OpenAPISpec): NavTag[] {
  if (!spec?.paths) return [];
  const seen = new Set<string>();
  const tags: NavTag[] = [];
  for (const methods of Object.values(spec.paths)) {
    for (const op of Object.values(methods)) {
      if (!op?.tags) continue;
      for (const tag of op.tags) {
        if (!seen.has(tag)) {
          seen.add(tag);
          // Swagger UI uses this id pattern for tag sections
          tags.push({ id: `operations-tag-${tag.replace(/\s+/g, '-')}`, label: tag });
        }
      }
    }
  }
  tags.sort((a, b) => a.label.localeCompare(b.label));
  return tags;
}

const NAV_WIDTH = 200;

const ApiDocumentation: React.FC = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [navTags, setNavTags] = useState<NavTag[]>([]);
  const [activeTag, setActiveTag] = useState<string>('');
  const specRef = useRef<OpenAPISpec | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Forward the user's bearer token so "Try it out" works on auth'd endpoints.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- swagger-ui-react's Request type lacks headers
  const requestInterceptor = useCallback((req: any) => {
    const token = localStorage.getItem('auth_token');
    if (token) req.headers['Authorization'] = `Bearer ${token}`;
    return req;
  }, []);

  // onComplete fires when SwaggerUI finishes rendering.
  // We extract tags from the loaded spec at that point.
  const onComplete = useCallback((system: { getState: () => { toJS: () => { spec?: { json?: OpenAPISpec } } } }) => {
    try {
      const spec = system.getState().toJS().spec?.json;
      if (spec) {
        specRef.current = spec;
        setNavTags(buildNavTags(spec));
      }
    } catch {
      // spec not available yet — harmless
    }
  }, []);

  // Set up an IntersectionObserver to track which tag section is visible.
  useEffect(() => {
    if (!navTags.length) return;

    observerRef.current?.disconnect();

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the topmost visible section
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActiveTag(visible[0].target.id);
        }
      },
      { rootMargin: '-10% 0px -70% 0px', threshold: 0 }
    );

    // Small delay to allow Swagger UI to finish rendering its DOM
    const timer = setTimeout(() => {
      navTags.forEach(({ id }) => {
        const el = document.getElementById(id);
        if (el) observer.observe(el);
      });
    }, 300);

    observerRef.current = observer;
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [navTags]);

  const scrollToTag = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    // Offset for the fixed AppBar (~64px) plus a little breathing room
    const y = el.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top: y, behavior: 'smooth' });
    setActiveTag(id);
  }, []);

  const primaryColor = theme.palette.primary.main;
  const navBg = isDark ? '#1e1e1e' : '#fafafa';
  const navBorder = isDark ? '#333' : '#e0e0e0';
  const navText = isDark ? '#ccc' : '#555';
  const activeText = primaryColor;
  const activeBg = isDark ? `${primaryColor}26` : `${primaryColor}14`;

  return (
    <Box>
      {/* Page title */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4">API Swagger Documentation</Typography>
        <Typography variant="body2" color="text.secondary">
          Interactive API reference — use the Authorize button to authenticate with an API key
        </Typography>
      </Box>

      {/* Layout: sticky left nav + Swagger UI content */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0 }}>

        {/* ---- Left navigation panel ---- */}
        {navTags.length > 0 && (
          <Box
            sx={{
              width: NAV_WIDTH,
              flexShrink: 0,
              position: 'sticky',
              top: 80,           // below the fixed AppBar
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
                  color: isDark ? '#888' : '#999',
                  fontSize: '0.68rem',
                }}
              >
                Sections
              </Typography>
              <List dense disablePadding>
                {navTags.map(({ id, label }) => {
                  const isActive = activeTag === id;
                  return (
                    <ListItemButton
                      key={id}
                      onClick={() => scrollToTag(id)}
                      sx={{
                        py: 0.5,
                        px: 2,
                        borderLeft: isActive ? `3px solid ${primaryColor}` : '3px solid transparent',
                        background: isActive ? activeBg : 'transparent',
                        borderRadius: 0,
                        '&:hover': {
                          background: isDark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.04)',
                        },
                      }}
                    >
                      <ListItemText
                        primary={label}
                        primaryTypographyProps={{
                          sx: {
                            fontSize: '0.78rem',
                            fontWeight: isActive ? 600 : 400,
                            color: isActive ? activeText : navText,
                            lineHeight: 1.4,
                          },
                        }}
                      />
                    </ListItemButton>
                  );
                })}
              </List>
            </Paper>
          </Box>
        )}

        {/* ---- Swagger UI content ---- */}
        <Box ref={contentRef} sx={{ flex: 1, minWidth: 0 }}>
          <style>{BASE_CSS + (isDark ? DARK_EXTRA : LIGHT_EXTRA)}</style>

          <SwaggerUI
            url="/swagger.json"
            docExpansion="list"
            deepLinking
            tryItOutEnabled
            requestInterceptor={requestInterceptor}
            persistAuthorization
            onComplete={onComplete}
            {...{ tagsSorter: 'alpha' } as Record<string, unknown>}
          />
        </Box>
      </Box>
    </Box>
  );
};

export default ApiDocumentation;
