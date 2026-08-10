import { render, screen } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@mui/material'
import MarkdownRenderer from '../MarkdownRenderer'
import { describe, it, expect } from 'vitest'

function renderWithTheme(ui: React.ReactElement) {
  const theme = createTheme({ palette: { mode: 'light' } })
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>)
}

function renderWithDarkTheme(ui: React.ReactElement) {
  const theme = createTheme({ palette: { mode: 'dark' } })
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

  // Issue #681. react-markdown runs with passNode: true, so it hands each custom
  // component the underlying hast node. The heading overrides used to spread it
  // straight onto the DOM element, producing `<h2 node="[object Object]">` on
  // every heading of every README. React 19 stopped warning about unknown props,
  // so nothing surfaced it.
  //
  // Verified against react-markdown 10 that this fails without the fix: with the
  // node prop spread, `# Hello *world*` renders
  // `<h2 node="[object Object]">Hello <em>world</em></h2>`.
  //
  // Asserted across all six levels because the overrides are six separate
  // closures -- fixing h1 and missing h4 is exactly the kind of partial fix a
  // single-heading test would certify as done.
  it('does not leak react-markdown internals onto heading elements', () => {
    const { container } = renderWithTheme(
      <MarkdownRenderer>
        {'# One\n## Two\n### Three\n#### Four\n##### Five\n###### Six'}
      </MarkdownRenderer>,
    )

    const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6')
    expect(headings).toHaveLength(6)
    for (const heading of headings) {
      expect(
        heading.getAttribute('node'),
        `<${heading.tagName.toLowerCase()}> carries a node attribute: ${heading.outerHTML}`,
      ).toBeNull()
    }
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

  it('strips a javascript: URI from a markdown link href', () => {
    renderWithTheme(<MarkdownRenderer>{'[click me](javascript:alert(1))'}</MarkdownRenderer>)
    const link = screen.getByText('click me')
    expect(link.tagName).toBe('A')
    expect(link.getAttribute('href')).toBeNull()
  })

  it('strips a javascript: URI from a markdown image src', () => {
    const { container } = renderWithTheme(
      <MarkdownRenderer>{'![alt text](javascript:alert(1))'}</MarkdownRenderer>,
    )
    const img = container.querySelector('img')
    expect(img).not.toBeNull()
    expect(img?.getAttribute('src')).toBeNull()
  })

  it('strips a data:text/html URI from a markdown link href', () => {
    const { container } = renderWithTheme(
      <MarkdownRenderer>
        {'[data payload](data:text/html,<script>alert(1)</script>)'}
      </MarkdownRenderer>,
    )
    const link = screen.getByText('data payload')
    expect(link.tagName).toBe('A')
    expect(link.getAttribute('href')).toBeNull()
    expect(container.querySelectorAll('script').length).toBe(0)
  })

  it('handles empty string content', () => {
    const { container } = renderWithTheme(<MarkdownRenderer>{''}</MarkdownRenderer>)

    // Should render without crashing, with minimal content
    expect(container).toBeTruthy()
  })

  it('shifts h1 down to h2', () => {
    const { container } = renderWithTheme(<MarkdownRenderer>{'# Heading One'}</MarkdownRenderer>)
    expect(container.querySelector('h2')).not.toBeNull()
    expect(container.querySelector('h1')).toBeNull()
  })

  it('shifts h2 down to h3', () => {
    const { container } = renderWithTheme(<MarkdownRenderer>{'## Heading Two'}</MarkdownRenderer>)
    expect(container.querySelector('h3')).not.toBeNull()
  })

  it('shifts h3 down to h4', () => {
    const { container } = renderWithTheme(
      <MarkdownRenderer>{'### Heading Three'}</MarkdownRenderer>,
    )
    expect(container.querySelector('h4')).not.toBeNull()
  })

  it('shifts h4 down to h5', () => {
    const { container } = renderWithTheme(
      <MarkdownRenderer>{'#### Heading Four'}</MarkdownRenderer>,
    )
    expect(container.querySelector('h5')).not.toBeNull()
  })

  it('shifts h5 down to h6', () => {
    const { container } = renderWithTheme(
      <MarkdownRenderer>{'##### Heading Five'}</MarkdownRenderer>,
    )
    expect(container.querySelector('h6')).not.toBeNull()
  })

  it('keeps h6 as h6', () => {
    const { container } = renderWithTheme(
      <MarkdownRenderer>{'###### Heading Six'}</MarkdownRenderer>,
    )
    const h6s = container.querySelectorAll('h6')
    expect(h6s.length).toBe(1)
  })

  it('renders code, code blocks, and tables under a dark theme', () => {
    // The sx callback's `theme.palette.mode === 'dark'` branches (code/pre
    // background+text, table cell borders and header background) are only
    // ever exercised under a dark theme -- every other test in this file uses
    // the light theme.
    const markdown = [
      'Use `terraform init` to start',
      '',
      '```hcl',
      'resource "aws_instance" "example" {}',
      '```',
      '',
      '| Name | Version |',
      '| --- | --- |',
      '| aws | 5.0 |',
    ].join('\n')

    const { container } = renderWithDarkTheme(<MarkdownRenderer>{markdown}</MarkdownRenderer>)

    expect(screen.getByText('terraform init').tagName).toBe('CODE')
    expect(screen.getByText(/resource "aws_instance"/)).toBeInTheDocument()
    expect(container.querySelector('table')).not.toBeNull()
  })
})
