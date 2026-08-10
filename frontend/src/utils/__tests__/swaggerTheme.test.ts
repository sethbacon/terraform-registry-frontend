import { describe, expect, it, afterEach } from 'vitest'
import { enforceSwaggerA11yStyles, getSwaggerThemeCss } from '../swaggerTheme'

// Regression coverage for the swagger-ui-react class names this module
// depends on (see the module comment for the manual-QA steps a dependency
// bump also needs). These fixtures mirror the DOM structure swagger-ui-react
// 5.32.6 actually renders for each element.
describe('enforceSwaggerA11yStyles', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  function renderFixture() {
    document.body.innerHTML = `
      <div class="swagger-ui">
        <div class="opblock opblock-get">
          <div class="opblock-summary">
            <span class="opblock-summary-method">GET</span>
            <div class="opblock-summary-control">
              <a href="#" class="opblock-summary-path" data-foo="bar">/things</a>
            </div>
          </div>
        </div>
        <pre class="version">1.2.3</pre>
        <span class="url">https://api.example.com</span>
        <div class="info">
          <a class="link" href="https://example.com/tos">Terms</a>
        </div>
        <button class="btn authorize">
          <span>Authorize</span>
          <svg></svg>
        </button>
      </div>
    `
  }

  it('colours a method badge and turns white-on-brand for light mode', () => {
    renderFixture()
    enforceSwaggerA11yStyles(false)

    const badge = document.querySelector<HTMLElement>('.opblock-get .opblock-summary-method')!
    expect(badge.style.background).toBe('#5C4EE5')
    expect(badge.style.color).toBe('#fff')
  })

  it('applies theme-aware contrast to version stamp, url, and info link', () => {
    renderFixture()

    enforceSwaggerA11yStyles(false)
    expect(document.querySelector<HTMLElement>('pre.version')!.style.color).toBe('#555')
    expect(document.querySelector<HTMLElement>('span.url')!.style.color).toBe('#3b6fb6')
    expect(document.querySelector<HTMLElement>('.info a.link')!.style.color).toBe('#3b6fb6')

    enforceSwaggerA11yStyles(true)
    expect(document.querySelector<HTMLElement>('pre.version')!.style.color).toBe('#ccc')
    expect(document.querySelector<HTMLElement>('span.url')!.style.color).toBe('#8ab4f8')
    expect(document.querySelector<HTMLElement>('.info a.link')!.style.color).toBe('#8ab4f8')
  })

  it('colours the authorize button and its nested span/svg', () => {
    renderFixture()
    enforceSwaggerA11yStyles(false)

    const btn = document.querySelector<HTMLElement>('.btn.authorize')!
    expect(btn.style.borderColor).toBe('#007a52')
    expect(btn.querySelector<HTMLElement>('span')!.style.color).toBe('#007a52')
    expect(btn.querySelector<SVGElement>('svg')!.style.fill).toBe('#007a52')
  })

  // #683 — this used to assert the <a> was REPLACED by a <span>. That
  // replacement removed a node swagger-ui's React tree still referenced, and
  // React's later removeChild against a parent no longer containing it threw
  // NotFoundError, taking the whole /api-docs route to the ErrorBoundary.
  //
  // The nested-interactive violation is now cleared by dropping href instead:
  // an <a> without href has no implicit link role and is not focusable. The
  // assertions therefore invert -- the element must SURVIVE, in place, with its
  // identity intact.
  it('clears the nested-interactive violation without replacing the anchor node', () => {
    renderFixture()
    const control = document.querySelector('.opblock-summary-control')!
    const before = control.querySelector('a')!

    enforceSwaggerA11yStyles(false)

    const after = control.querySelector('a')
    // Same node object, still attached: anything else is the crash this fixes.
    expect(after).toBe(before)
    expect(after!.isConnected).toBe(true)
    // The violation itself is gone.
    expect(after!.hasAttribute('href')).toBe(false)
    // And nothing else about the element was discarded -- the old replacement
    // dropped every non-data attribute and rebuilt the class list by hand.
    expect(after!.textContent).toBe('/things')
    expect(after!.className).toBe('opblock-summary-path')
    expect(after!.getAttribute('data-foo')).toBe('bar')
  })

  it('is idempotent, because the MutationObserver re-runs it constantly', () => {
    renderFixture()
    const before = document.querySelector('.opblock-summary-control a')!

    enforceSwaggerA11yStyles(false)
    enforceSwaggerA11yStyles(false)
    enforceSwaggerA11yStyles(false)

    const after = document.querySelector('.opblock-summary-control a')
    expect(after).toBe(before)
    expect(after!.hasAttribute('href')).toBe(false)
  })

  it('is a no-op when no matching elements exist', () => {
    document.body.innerHTML = '<div class="swagger-ui"></div>'
    expect(() => enforceSwaggerA11yStyles(false)).not.toThrow()
  })
})

describe('getSwaggerThemeCss', () => {
  it('includes the shared base rules regardless of theme', () => {
    const light = getSwaggerThemeCss(false)
    const dark = getSwaggerThemeCss(true)
    const sharedRule = '.swagger-ui .topbar { display: none !important; }'
    expect(light).toContain(sharedRule)
    expect(dark).toContain(sharedRule)
  })

  it('includes light-only overrides only when isDark is false', () => {
    const css = getSwaggerThemeCss(false)
    expect(css).toContain('.swagger-ui .scheme-container { background: #fafafa !important;')
    expect(css).not.toContain('.swagger-ui .scheme-container select { color-scheme: dark;')
  })

  it('includes dark-only overrides only when isDark is true', () => {
    const css = getSwaggerThemeCss(true)
    expect(css).toContain('.swagger-ui .scheme-container select { color-scheme: dark;')
    expect(css).not.toContain('.swagger-ui .scheme-container { background: #fafafa !important;')
  })

  it('lightens the opblock summary path text in dark mode (color-contrast fix)', () => {
    const darkRule = '.swagger-ui .opblock-summary-path .nostyle { color: #e0e0e0 !important; }'
    expect(getSwaggerThemeCss(true)).toContain(darkRule)
    expect(getSwaggerThemeCss(false)).not.toContain(darkRule)
  })
})
