// ---------------------------------------------------------------------------
// swagger-ui-react DOM/CSS theming
//
// Verified against swagger-ui-react 5.32.6 (see frontend/package.json).
// Swagger UI does not expose a supported theming API for the elements
// targeted below, so this module reaches directly into its rendered DOM via
// hard-coded class selectors and overrides its default styling with raw CSS.
// A dependency bump that renames any of these classes will silently stop
// applying the fixes below -- there is no compile-time signal for this.
//
// After bumping swagger-ui-react:
//   1. Run `npx vitest run src/utils/__tests__/swaggerTheme.test.ts` -- it
//      exercises enforceSwaggerA11yStyles() against DOM fixtures using
//      today's class names, so at minimum confirms this module's own logic
//      is unchanged.
//   2. Manually load /api-docs in both light and dark mode and confirm:
//      method badges keep white-on-colour text, version stamps/URL/info
//      links/authorize button keep readable contrast, and the page still
//      matches the app's Inter font + palette (no default Swagger blue).
// ---------------------------------------------------------------------------

const METHOD_COLORS: Record<string, string> = {
  get: '#5C4EE5',
  post: '#00875a',
  put: '#995c00',
  delete: '#c0392b',
  patch: '#0a7fa0',
  head: '#5C4EE5',
  options: '#5C4EE5',
}

/** Apply WCAG-compliant colours directly to Swagger UI DOM elements. */
export function enforceSwaggerA11yStyles(dark: boolean): void {
  // Method badges — white text on dark bg
  for (const [method, bg] of Object.entries(METHOD_COLORS)) {
    document
      .querySelectorAll<HTMLElement>(
        `.swagger-ui .opblock.opblock-${method} .opblock-summary-method`,
      )
      .forEach((el) => {
        el.style.setProperty('background', bg, 'important')
        el.style.setProperty('color', '#fff', 'important')
      })
  }

  // Version stamps — theme-aware contrast
  const versionColor = dark ? '#ccc' : '#555'
  const versionBg = dark ? '#333' : '#e8e8e8'
  document.querySelectorAll<HTMLElement>('.swagger-ui pre.version').forEach((el) => {
    el.style.setProperty('color', versionColor, 'important')
    el.style.setProperty('background', versionBg, 'important')
  })

  // URL field
  const urlColor = dark ? '#8ab4f8' : '#3b6fb6'
  document.querySelectorAll<HTMLElement>('.swagger-ui span.url').forEach((el) => {
    el.style.setProperty('color', urlColor, 'important')
  })

  // Info links (terms of service, contact, etc.)
  const linkColor = dark ? '#8ab4f8' : '#3b6fb6'
  document
    .querySelectorAll<HTMLElement>('.swagger-ui .info a.link, .swagger-ui .info .link')
    .forEach((el) => {
      el.style.setProperty('color', linkColor, 'important')
    })

  // Authorize button
  const authColor = dark ? '#2ea77a' : '#00875a'
  document.querySelectorAll<HTMLElement>('.swagger-ui .btn.authorize').forEach((btn) => {
    btn.style.setProperty('border-color', authColor, 'important')
    btn.style.setProperty('color', authColor, 'important')
    const span = btn.querySelector<HTMLElement>('span')
    if (span) span.style.setProperty('color', authColor, 'important')
    const svg = btn.querySelector<SVGElement>('svg')
    if (svg) svg.style.setProperty('fill', authColor, 'important')
  })

  // Nested-interactive fix: replace <a> inside summary buttons with <span>
  document
    .querySelectorAll<HTMLAnchorElement>('.swagger-ui .opblock-summary-control a')
    .forEach((a) => {
      const span = document.createElement('span')
      span.className = a.className
      span.textContent = a.textContent
      Array.from(a.attributes).forEach((attr) => {
        if (attr.name.startsWith('data-')) span.setAttribute(attr.name, attr.value)
      })
      a.replaceWith(span)
    })
}

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
  .swagger-ui .topbar { display: none !important; }

  /* ---------- hide the info header block (we render our own) ---------- */
  .swagger-ui .information-container { display: none !important; }

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

  .swagger-ui .opblock.opblock-get .opblock-summary .opblock-summary-method,
  .swagger-ui .opblock.opblock-get .opblock-summary-method { background: #5C4EE5 !important; color: #fff !important; }
  .swagger-ui .opblock.opblock-post .opblock-summary .opblock-summary-method,
  .swagger-ui .opblock.opblock-post .opblock-summary-method { background: #00875a !important; color: #fff !important; }
  .swagger-ui .opblock.opblock-put .opblock-summary .opblock-summary-method,
  .swagger-ui .opblock.opblock-put .opblock-summary-method { background: #995c00 !important; color: #fff !important; }
  .swagger-ui .opblock.opblock-delete .opblock-summary .opblock-summary-method,
  .swagger-ui .opblock.opblock-delete .opblock-summary-method { background: #c0392b !important; color: #fff !important; }
  .swagger-ui .opblock.opblock-patch .opblock-summary .opblock-summary-method,
  .swagger-ui .opblock.opblock-patch .opblock-summary-method { background: #0a7fa0 !important; color: #fff !important; }

  /* ---------- version stamps — ensure readable contrast ---------- */
  .swagger-ui .version-stamp .version,
  .swagger-ui .version-stamp pre.version,
  .swagger-ui small > .version,
  .swagger-ui small > pre.version,
  .swagger-ui pre.version { color: #555 !important; background: #e8e8e8 !important; }

  /* ---------- url field contrast fix ---------- */
  .swagger-ui .info .url,
  .swagger-ui span.url { color: #3b6fb6 !important; }

  /* ---------- info links contrast fix ---------- */
  .swagger-ui .info a,
  .swagger-ui .info .link,
  .swagger-ui .info__tos a.link,
  .swagger-ui .info__contact a.link,
  .swagger-ui a.link[rel="noopener noreferrer"] { color: #3b6fb6 !important; }
  .swagger-ui .info a:hover,
  .swagger-ui .info .link:hover,
  .swagger-ui a.link[rel="noopener noreferrer"]:hover { color: #2d5a96 !important; }

  /* ---------- authorize button contrast fix ---------- */
  .swagger-ui .btn.authorize,
  .swagger-ui .auth-wrapper .btn.authorize { border-color: #00875a !important; color: #00875a !important; }
  .swagger-ui .btn.authorize span { color: #00875a !important; }
  .swagger-ui .btn.authorize svg { fill: #00875a !important; }

  /* ---------- response code pills ---------- */
  .swagger-ui .response-col_status { font-weight: 600; }

  /* remove the very wide left margin swagger-ui adds by default */
  .swagger-ui .wrapper { padding: 0; max-width: 100%; overflow: hidden; }

  /* prevent tables and code blocks from pushing past the container */
  .swagger-ui table { max-width: 100%; }
`

const LIGHT_EXTRA = `
  .swagger-ui .scheme-container { background: #fafafa !important; border-bottom: 1px solid #e0e0e0; }
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
`

const DARK_EXTRA = `
  .swagger-ui,
  .swagger-ui .info,
  .swagger-ui .scheme-container,
  .swagger-ui section.models,
  .swagger-ui .opblock-tag-section { background: #1e1e1e; }

  .swagger-ui .scheme-container { background: #1e1e1e !important; border-bottom: 1px solid #333; }
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

  /* dark-mode version stamp override */
  .swagger-ui .version-stamp .version,
  .swagger-ui .version-stamp pre.version,
  .swagger-ui small > .version,
  .swagger-ui small > pre.version,
  .swagger-ui pre.version { color: #ccc !important; background: #333 !important; }
`

/** Combined CSS override string for the current theme mode. */
export function getSwaggerThemeCss(isDark: boolean): string {
  return BASE_CSS + (isDark ? DARK_EXTRA : LIGHT_EXTRA)
}
