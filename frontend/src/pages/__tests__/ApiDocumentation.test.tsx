import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ThemeProvider, createTheme } from '@mui/material/styles'

vi.mock('swagger-ui-react', () => ({
  default: (props: { url: string }) => (
    <div data-testid="swagger-ui" data-url={props.url}>
      SwaggerUI Mock
    </div>
  ),
}))

vi.mock('swagger-ui-react/swagger-ui.css', () => ({}))

import ApiDocumentation from '../ApiDocumentation'

const theme = createTheme()

const renderWithTheme = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>)

describe('ApiDocumentation', () => {
  it('renders the page title', () => {
    renderWithTheme(<ApiDocumentation />)
    expect(screen.getByText(/API Swagger Documentation/i)).toBeInTheDocument()
  })

  it('renders SwaggerUI component with swagger.json url', () => {
    renderWithTheme(<ApiDocumentation />)
    const swaggerEl = screen.getByTestId('swagger-ui')
    expect(swaggerEl).toBeInTheDocument()
    expect(swaggerEl.getAttribute('data-url')).toBe('/swagger.json')
  })
})
