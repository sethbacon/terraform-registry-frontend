import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import ProviderDetailHeader from '../ProviderDetailHeader'
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

describe('ProviderDetailHeader', () => {
  const versions = [makeVersion()]
  const defaultProps = {
    provider: makeProvider(),
    namespace: 'hashicorp',
    name: 'aws',
    versions,
    selectedVersion: versions[0],
    canManage: false,
    onBack: vi.fn(),
    onSelectVersion: vi.fn(),
    onPublishNewVersion: vi.fn(),
    onOpenDeleteProviderDialog: vi.fn(),
  }

  it('renders breadcrumbs, title and description', () => {
    render(<ProviderDetailHeader {...defaultProps} />)
    expect(screen.getByText('Providers')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('aws')
    expect(screen.getByText('AWS provider')).toBeInTheDocument()
    expect(screen.getByText('4321 downloads')).toBeInTheDocument()
  })

  it('falls back to a placeholder when the provider has no description', () => {
    render(
      <ProviderDetailHeader
        {...defaultProps}
        provider={makeProvider({ description: undefined })}
      />,
    )
    expect(screen.getByText('No description available')).toBeInTheDocument()
  })

  it('navigates back from the breadcrumb and the back button', async () => {
    const onBack = vi.fn()
    render(<ProviderDetailHeader {...defaultProps} onBack={onBack} />)
    await userEvent.click(screen.getByText('Providers'))
    await userEvent.click(screen.getByRole('button', { name: /back to providers/i }))
    expect(onBack).toHaveBeenCalledTimes(2)
  })

  it('hides manage actions when the user cannot manage', () => {
    render(<ProviderDetailHeader {...defaultProps} />)
    expect(screen.queryByRole('button', { name: /publish new version/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /delete provider/i })).not.toBeInTheDocument()
  })

  it('shows manage actions for managers of a non-mirrored provider', async () => {
    const onPublishNewVersion = vi.fn()
    const onOpenDeleteProviderDialog = vi.fn()
    render(
      <ProviderDetailHeader
        {...defaultProps}
        canManage
        onPublishNewVersion={onPublishNewVersion}
        onOpenDeleteProviderDialog={onOpenDeleteProviderDialog}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /publish new version/i }))
    await userEvent.click(screen.getByRole('button', { name: /delete provider/i }))
    expect(onPublishNewVersion).toHaveBeenCalled()
    expect(onOpenDeleteProviderDialog).toHaveBeenCalled()
  })

  it('hides Publish New Version for mirrored providers but shows the mirror chip', () => {
    render(
      <ProviderDetailHeader
        {...defaultProps}
        canManage
        provider={makeProvider({ source: 'hashicorp/aws' })}
      />,
    )
    expect(screen.queryByRole('button', { name: /publish new version/i })).not.toBeInTheDocument()
    expect(screen.getByText('Network Mirrored')).toBeInTheDocument()
  })

  it('shows the deprecated chip when the selected version is deprecated', () => {
    const deprecated = makeVersion({ deprecated: true })
    render(
      <ProviderDetailHeader
        {...defaultProps}
        versions={[deprecated]}
        selectedVersion={deprecated}
      />,
    )
    expect(screen.getByText('Deprecated')).toBeInTheDocument()
  })

  it('reports the picked version through onSelectVersion', async () => {
    const onSelectVersion = vi.fn()
    const older = makeVersion({ id: 'v-2', version: '4.0.0' })
    render(
      <ProviderDetailHeader
        {...defaultProps}
        versions={[versions[0], older]}
        onSelectVersion={onSelectVersion}
      />,
    )
    await userEvent.click(screen.getByRole('combobox'))
    await userEvent.click(await screen.findByRole('option', { name: /v4\.0\.0/ }))
    expect(onSelectVersion).toHaveBeenCalledWith(older)
  })
})
