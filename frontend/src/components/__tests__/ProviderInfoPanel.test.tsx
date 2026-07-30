import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import ProviderInfoPanel from '../ProviderInfoPanel'
import type { Provider, ProviderVersion } from '../../types'

function makeProvider(overrides: Partial<Provider> = {}): Provider {
  return {
    id: 'p-1',
    namespace: 'hashicorp',
    type: 'aws',
    description: 'AWS provider',
    organization_id: 'org-1',
    download_count: 4321,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  } as Provider
}

function makeVersion(overrides: Partial<ProviderVersion> = {}): ProviderVersion {
  return {
    id: 'v-1',
    provider_id: 'p-1',
    version: '5.0.0',
    protocols: ['6.0'],
    published_at: '2025-06-01T00:00:00Z',
    created_at: '2025-06-01T00:00:00Z',
    deprecated: false,
    ...overrides,
  } as ProviderVersion
}

/** Field values sit next to their <strong> label, so assert via the shared row. */
function row(label: string): HTMLElement {
  return screen.getByText(label).parentElement as HTMLElement
}

describe('ProviderInfoPanel', () => {
  const defaultProps = {
    provider: makeProvider(),
    namespace: 'hashicorp',
    name: 'aws',
    versions: [makeVersion()],
    selectedVersion: makeVersion(),
    githubUrl: null,
    changelogUrl: null,
  }

  it('renders namespace, name and download count', () => {
    render(<ProviderInfoPanel {...defaultProps} />)
    expect(screen.getByText('Provider Information')).toBeInTheDocument()
    expect(row('Namespace:')).toHaveTextContent('hashicorp')
    expect(row('Name:')).toHaveTextContent('aws')
    expect(row('Total Downloads:')).toHaveTextContent('4321')
  })

  it('shows the newest non-deprecated version as latest', () => {
    render(
      <ProviderInfoPanel
        {...defaultProps}
        versions={[
          makeVersion({ id: 'v-2', version: '6.0.0', deprecated: true }),
          makeVersion({ id: 'v-1', version: '5.0.0' }),
        ]}
      />,
    )
    expect(row('Latest Version:')).toHaveTextContent('5.0.0')
  })

  it('falls back to N/A when there are no versions', () => {
    render(<ProviderInfoPanel {...defaultProps} versions={[]} />)
    expect(row('Latest Version:')).toHaveTextContent('N/A')
  })

  it('hides repository and changelog buttons when no links are supplied', () => {
    render(<ProviderInfoPanel {...defaultProps} />)
    expect(screen.queryByText(/GitHub Repository/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Changelog/i)).not.toBeInTheDocument()
  })

  it('renders repository and changelog links when supplied', () => {
    render(
      <ProviderInfoPanel
        {...defaultProps}
        githubUrl="https://github.com/hashicorp/terraform-provider-aws"
        changelogUrl="https://github.com/hashicorp/terraform-provider-aws/releases/tag/v5.0.0"
      />,
    )
    expect(screen.getByRole('link', { name: /GitHub Repository/i })).toHaveAttribute(
      'href',
      'https://github.com/hashicorp/terraform-provider-aws',
    )
    expect(screen.getByRole('link', { name: /Changelog v5\.0\.0/i })).toHaveAttribute(
      'rel',
      'noopener noreferrer',
    )
  })

  it('renders the creator when the provider records one', () => {
    render(
      <ProviderInfoPanel {...defaultProps} provider={makeProvider({ created_by_name: 'alice' })} />,
    )
    expect(row('Created By:')).toHaveTextContent('alice')
  })
})
