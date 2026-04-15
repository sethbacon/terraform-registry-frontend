import { render, act, screen } from '@testing-library/react'
import { ThemeProvider, useThemeMode } from '../ThemeContext'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const THEME_KEY = 'terraform-registry-theme'

function ThemeConsumer() {
  const { mode, toggleTheme } = useThemeMode()
  return (
    <div>
      <span data-testid="mode">{mode}</span>
      <button onClick={toggleTheme}>Toggle</button>
    </div>
  )
}

describe('ThemeContext', () => {
  beforeEach(() => {
    localStorage.clear()
    // Default: mock matchMedia to prefer light
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
  })

  it('throws when useThemeMode is used outside ThemeProvider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => { })

    function BadConsumer() {
      useThemeMode()
      return null
    }

    expect(() => render(<BadConsumer />)).toThrow('useThemeMode must be used within a ThemeProvider')
  })

  it('defaults to light mode when no preference is stored', () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    )

    expect(screen.getByTestId('mode').textContent).toBe('light')
  })

  it('respects system dark mode preference when no localStorage value', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })

    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    )

    expect(screen.getByTestId('mode').textContent).toBe('dark')
  })

  it('reads saved theme from localStorage', () => {
    localStorage.setItem(THEME_KEY, 'dark')

    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    )

    expect(screen.getByTestId('mode').textContent).toBe('dark')
  })

  it('toggleTheme switches from light to dark', () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    )

    expect(screen.getByTestId('mode').textContent).toBe('light')

    act(() => {
      screen.getByText('Toggle').click()
    })

    expect(screen.getByTestId('mode').textContent).toBe('dark')
  })

  it('toggleTheme switches from dark to light', () => {
    localStorage.setItem(THEME_KEY, 'dark')

    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    )

    expect(screen.getByTestId('mode').textContent).toBe('dark')

    act(() => {
      screen.getByText('Toggle').click()
    })

    expect(screen.getByTestId('mode').textContent).toBe('light')
  })

  it('persists theme to localStorage on toggle', () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    )

    act(() => {
      screen.getByText('Toggle').click()
    })

    expect(localStorage.getItem(THEME_KEY)).toBe('dark')

    act(() => {
      screen.getByText('Toggle').click()
    })

    expect(localStorage.getItem(THEME_KEY)).toBe('light')
  })
})
