import { render, screen } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@mui/material'
import MarkdownRenderer from '../MarkdownRenderer'
import { describe, it, expect } from 'vitest'

function renderWithTheme(ui: React.ReactElement) {
  const theme = createTheme({ palette: { mode: 'light' } })
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>)
}

describe('MarkdownRenderer', () => {
  it('renders basic markdown text as HTML', () => {
    renderWithTheme(<MarkdownRenderer>{'Hello **world**'}</MarkdownRenderer>)

    expect(screen.getByText('world')).toBeInTheDocument()
    // "world" should be in a <strong> tag
    const strong = screen.getByText('world')
    expect(strong.tagName).toBe('STRONG')
  })

  it('renders headings', () => {
    renderWithTheme(<MarkdownRenderer>{'# Heading 1\n## Heading 2'}</MarkdownRenderer>)

    expect(screen.getByText('Heading 1')).toBeInTheDocument()
    expect(screen.getByText('Heading 2')).toBeInTheDocument()
  })

  it('renders inline code', () => {
    renderWithTheme(<MarkdownRenderer>{'Use `terraform init` to start'}</MarkdownRenderer>)

    const code = screen.getByText('terraform init')
    expect(code.tagName).toBe('CODE')
  })

  it('renders code blocks', () => {
    const markdown = '```hcl\nresource "aws_instance" "example" {}\n```'
    renderWithTheme(<MarkdownRenderer>{markdown}</MarkdownRenderer>)

    expect(screen.getByText(/resource "aws_instance"/)).toBeInTheDocument()
  })

  it('renders GFM tables', () => {
    const markdown = `| Name | Version |
| --- | --- |
| aws | 5.0 |`

    const { container } = renderWithTheme(<MarkdownRenderer>{markdown}</MarkdownRenderer>)

    const table = container.querySelector('table')
    expect(table).not.toBeNull()
    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByText('aws')).toBeInTheDocument()
  })

  it('renders GFM strikethrough', () => {
    renderWithTheme(<MarkdownRenderer>{'~~deprecated~~'}</MarkdownRenderer>)

    const del = screen.getByText('deprecated')
    expect(del.tagName).toBe('DEL')
  })

  it('renders GFM task lists', () => {
    const markdown = `- [x] Done\n- [ ] Todo`
    const { container } = renderWithTheme(<MarkdownRenderer>{markdown}</MarkdownRenderer>)

    const checkboxes = container.querySelectorAll('input[type="checkbox"]')
    expect(checkboxes.length).toBe(2)
  })

  it('renders links', () => {
    renderWithTheme(<MarkdownRenderer>{'[Terraform](https://terraform.io)'}</MarkdownRenderer>)

    const link = screen.getByText('Terraform')
    expect(link.tagName).toBe('A')
    expect(link).toHaveAttribute('href', 'https://terraform.io')
  })

  it('sanitizes dangerous HTML (XSS prevention)', () => {
    const xssMarkdown = '<script>alert("xss")</script><img src=x onerror=alert(1)>'
    const { container } = renderWithTheme(<MarkdownRenderer>{xssMarkdown}</MarkdownRenderer>)

    // Script tags should be stripped by rehype-sanitize
    const scripts = container.querySelectorAll('script')
    expect(scripts.length).toBe(0)

    // img with onerror should have onerror stripped
    const imgs = container.querySelectorAll('img')
    for (const img of imgs) {
      expect(img.getAttribute('onerror')).toBeNull()
    }
  })

  it('handles empty string content', () => {
    const { container } = renderWithTheme(<MarkdownRenderer>{''}</MarkdownRenderer>)

    // Should render without crashing, with minimal content
    expect(container).toBeTruthy()
  })
})
