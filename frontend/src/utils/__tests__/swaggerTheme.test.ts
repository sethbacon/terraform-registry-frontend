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
    expect(btn.style.borderColor).toBe('#00875a')
    expect(btn.querySelector<HTMLElement>('span')!.style.color).toBe('#00875a')
    expect(btn.querySelector<SVGElement>('svg')!.style.fill).toBe('#00875a')
  })

  it('replaces the nested anchor inside opblock-summary-control with a span (nested-interactive a11y fix)', () => {
    renderFixture()
    enforceSwaggerA11yStyles(false)

    const control = document.querySelector('.opblock-summary-control')!
    expect(control.querySelector('a')).toBeNull()
    const span = control.querySelector('span.opblock-summary-path')!
    expect(span.textContent).toBe('/things')
    expect(span.getAttribute('data-foo')).toBe('bar')
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
})
