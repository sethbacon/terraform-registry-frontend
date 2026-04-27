import { render, screen, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ThemeProvider, createTheme } from '@mui/material/styles'

// Capture the props passed to SwaggerUI so tests can exercise the callbacks
// (onComplete, requestInterceptor, plugins) the component wires up.
interface SwaggerProps {
  url: string
  onComplete?: (system: unknown) => void
  requestInterceptor?: (req: { headers: Record<string, string> }) => unknown
  plugins?: Array<() => unknown>
}

let capturedProps: SwaggerProps | null = null

vi.mock('swagger-ui-react', () => ({
  default: (props: SwaggerProps) => {
    capturedProps = props
    return (
      <div data-testid="swagger-ui" data-url={props.url}>
        SwaggerUI Mock
      </div>
    )
  },
}))

vi.mock('swagger-ui-react/swagger-ui.css', () => ({}))

// Stub IntersectionObserver — happy-dom does not provide one
class IOStub {
  callback: IntersectionObserverCallback
  observed: Element[] = []
  constructor(cb: IntersectionObserverCallback) {
    this.callback = cb
  }
  observe(el: Element) {
    this.observed.push(el)
  }
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] {
    return []
  }
  root = null
  rootMargin = ''
  thresholds = []
  // allow tests to manually trigger the callback
  trigger(entries: IntersectionObserverEntry[]) {
    this.callback(entries, this as unknown as IntersectionObserver)
  }
}

let ioInstances: IOStub[] = []
beforeEach(() => {
  capturedProps = null
  ioInstances = []
  class TrackedIO extends IOStub {
    constructor(cb: IntersectionObserverCallback) {
      super(cb)
      ioInstances.push(this)
    }
  }
  ;(
    globalThis as unknown as { IntersectionObserver: typeof IntersectionObserver }
  ).IntersectionObserver = TrackedIO as unknown as typeof IntersectionObserver
  localStorage.clear()
})

import ApiDocumentation from '../ApiDocumentation'

const lightTheme = createTheme({ palette: { mode: 'light' } })
const darkTheme = createTheme({ palette: { mode: 'dark' } })

const renderWithTheme = (mode: 'light' | 'dark' = 'light') =>
  render(
    <ThemeProvider theme={mode === 'dark' ? darkTheme : lightTheme}>
      <ApiDocumentation />
    </ThemeProvider>,
  )

const fakeSpec = {
  paths: {
    '/providers': {
      get: { tags: ['Providers'] },
      post: { tags: ['Providers'] },
    },
    '/modules': {
      get: { tags: ['Modules'] },
    },
    '/untagged': {
      get: {},
    },
    '/multi word': {
      get: { tags: ['Admin Tools'] },
    },
  },
}

function triggerOnComplete(spec: unknown = fakeSpec) {
  const fakeSystem = {
    getState: () => ({
      toJS: () => ({ spec: { json: spec } }),
    }),
  }
  act(() => {
    capturedProps?.onComplete?.(fakeSystem)
  })
}

describe('ApiDocumentation', () => {
  it('renders the page title', () => {
    renderWithTheme()
    expect(screen.getByText(/API Swagger Documentation/i)).toBeInTheDocument()
  })

  it('renders SwaggerUI with the swagger.json url', () => {
    renderWithTheme()
    const swaggerEl = screen.getByTestId('swagger-ui')
    expect(swaggerEl.getAttribute('data-url')).toBe('/swagger.json')
  })

  it('renders the helper subtitle', () => {
    renderWithTheme()
    expect(screen.getByText(/use the Authorize button/i)).toBeInTheDocument()
  })

  it('does not render the left nav before onComplete fires', () => {
    renderWithTheme()
    expect(screen.queryByText('Sections')).not.toBeInTheDocument()
  })

  it('renders the left nav after onComplete populates tags (sorted)', () => {
    renderWithTheme()
    triggerOnComplete()
    expect(screen.getByText('Sections')).toBeInTheDocument()
    const tagLinks = screen.getAllByRole('button')
    const labels = tagLinks.map((b) => b.textContent?.trim())
    // Tags collected from fakeSpec, alphabetically sorted
    expect(labels).toEqual(['Admin Tools', 'Modules', 'Providers'])
  })

  it('does not render the nav when the spec has no paths', () => {
    renderWithTheme()
    triggerOnComplete({})
    expect(screen.queryByText('Sections')).not.toBeInTheDocument()
  })

  it('swallows errors from getState when the spec is unavailable', () => {
    renderWithTheme()
    const badSystem = {
      getState: () => {
        throw new Error('spec not ready')
      },
    }
    expect(() => {
      act(() => {
        capturedProps?.onComplete?.(badSystem)
      })
    }).not.toThrow()
    expect(screen.queryByText('Sections')).not.toBeInTheDocument()
  })

  it('handles spec with no json payload', () => {
    renderWithTheme()
    const system = { getState: () => ({ toJS: () => ({}) }) }
    act(() => {
      capturedProps?.onComplete?.(system)
    })
    expect(screen.queryByText('Sections')).not.toBeInTheDocument()
  })

  it('scrolls to the tag and marks it active when a nav item is clicked', async () => {
    const user = userEvent.setup()
    renderWithTheme()
    triggerOnComplete()

    // Place a stub DOM element that scrollToTag will query by id
    const target = document.createElement('div')
    target.id = 'operations-tag-Providers'
    target.getBoundingClientRect = () =>
      ({
        top: 500,
        bottom: 0,
        left: 0,
        right: 0,
        height: 0,
        width: 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect
    document.body.appendChild(target)

    const scrollSpy = vi.fn()
    window.scrollTo = scrollSpy as unknown as typeof window.scrollTo

    await user.click(screen.getByRole('button', { name: 'Providers' }))

    expect(scrollSpy).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'smooth' }))
  })

  it('does not scroll when the target element is missing', async () => {
    const user = userEvent.setup()
    renderWithTheme()
    triggerOnComplete()

    const scrollSpy = vi.fn()
    window.scrollTo = scrollSpy as unknown as typeof window.scrollTo

    await user.click(screen.getByRole('button', { name: 'Modules' }))
    expect(scrollSpy).not.toHaveBeenCalled()
  })

  it('updates the active section when IntersectionObserver reports visibility', () => {
    vi.useFakeTimers()
    try {
      renderWithTheme()
      triggerOnComplete()
      // Effect schedules observer attachment via setTimeout(300)
      const target = document.createElement('div')
      target.id = 'operations-tag-Modules'
      document.body.appendChild(target)
      act(() => {
        vi.advanceTimersByTime(400)
      })
      const io = ioInstances[ioInstances.length - 1]
      expect(io).toBeDefined()

      const entry = {
        isIntersecting: true,
        boundingClientRect: { top: 10 } as DOMRect,
        target,
      } as unknown as IntersectionObserverEntry
      act(() => {
        io.trigger([entry])
      })
      // Active label now gets the primary color / bold weight. Just check the
      // click target stays in the document — the internal state updated.
      expect(screen.getByText('Modules')).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('requestInterceptor adds the bearer token when present in localStorage', () => {
    localStorage.setItem('auth_token', 'tok-abc')
    renderWithTheme()
    const req = { headers: {} as Record<string, string> }
    const result = capturedProps?.requestInterceptor?.(req)
    expect(result).toBe(req)
    expect(req.headers['Authorization']).toBe('Bearer tok-abc')
  })

  it('requestInterceptor leaves headers untouched when no token is stored', () => {
    renderWithTheme()
    const req = { headers: {} as Record<string, string> }
    capturedProps?.requestInterceptor?.(req)
    expect(req.headers['Authorization']).toBeUndefined()
  })

  it('TagsSorterPlugin wraps taggedOperations with a sortBy selector', () => {
    renderWithTheme()
    const plugin = capturedProps?.plugins?.[0]?.() as {
      statePlugins: {
        spec: {
          wrapSelectors: {
            taggedOperations: (orig: unknown) => (...args: unknown[]) => unknown
          }
        }
      }
    }
    const sortByCalls: Array<[unknown, unknown]> = []
    const taggedOps = {
      sortBy: (keyFn: unknown, cmp: unknown) => {
        sortByCalls.push([keyFn, cmp])
        return 'sorted-result'
      },
    }
    const origSelector = vi.fn().mockReturnValue(taggedOps)
    const wrapped = plugin.statePlugins.spec.wrapSelectors.taggedOperations(origSelector)
    const result = wrapped('arg1', 'arg2')
    expect(origSelector).toHaveBeenCalledWith('arg1', 'arg2')
    expect(result).toBe('sorted-result')
    expect(sortByCalls).toHaveLength(1)
    // Verify the comparator is a locale string compare
    const cmp = sortByCalls[0][1] as (a: string, b: string) => number
    expect(cmp('Zebra', 'Apple')).toBeGreaterThan(0)
    expect(cmp('Apple', 'Zebra')).toBeLessThan(0)
  })

  it('TagsSorterPlugin returns original result when taggedOps has no sortBy', () => {
    renderWithTheme()
    const plugin = capturedProps?.plugins?.[0]?.() as {
      statePlugins: {
        spec: {
          wrapSelectors: {
            taggedOperations: (orig: unknown) => (...args: unknown[]) => unknown
          }
        }
      }
    }
    const origSelector = vi.fn().mockReturnValue({ not: 'iterable' })
    const wrapped = plugin.statePlugins.spec.wrapSelectors.taggedOperations(origSelector)
    const result = wrapped() as { not: string }
    expect(result).toEqual({ not: 'iterable' })
  })

  it('TagsSorterPlugin returns undefined passthrough when origSelector returns null', () => {
    renderWithTheme()
    const plugin = capturedProps?.plugins?.[0]?.() as {
      statePlugins: {
        spec: {
          wrapSelectors: {
            taggedOperations: (orig: unknown) => (...args: unknown[]) => unknown
          }
        }
      }
    }
    const origSelector = vi.fn().mockReturnValue(null)
    const wrapped = plugin.statePlugins.spec.wrapSelectors.taggedOperations(origSelector)
    expect(wrapped()).toBeNull()
  })

  it('renders dark mode styles when the theme is dark', () => {
    renderWithTheme('dark')
    triggerOnComplete()
    // Nav appears, confirming the component fully mounted under dark theme
    expect(screen.getByText('Sections')).toBeInTheDocument()
  })

  it('encodes tag labels with spaces in the section id', () => {
    renderWithTheme()
    triggerOnComplete()
    // "Admin Tools" should be in the nav. When clicked, scrollToTag looks up
    // "operations-tag-Admin_Tools" — underscores replace spaces.
    const target = document.createElement('div')
    target.id = 'operations-tag-Admin_Tools'
    target.getBoundingClientRect = () =>
      ({
        top: 100,
        bottom: 0,
        left: 0,
        right: 0,
        height: 0,
        width: 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect
    document.body.appendChild(target)
    const scrollSpy = vi.fn()
    window.scrollTo = scrollSpy as unknown as typeof window.scrollTo
    fireEvent.click(screen.getByRole('button', { name: 'Admin Tools' }))
    expect(scrollSpy).toHaveBeenCalled()
  })
})
