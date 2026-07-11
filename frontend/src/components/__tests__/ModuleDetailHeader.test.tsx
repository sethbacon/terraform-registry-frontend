import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import ModuleDetailHeader from '../ModuleDetailHeader'
import type { Module, ModuleVersion } from '../../types'

const baseModule: Module = {
  id: 'm-1',
  namespace: 'hashicorp',
  name: 'consul',
  system: 'aws',
  description: 'A consul module',
  download_count: 42,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
}

const versions: ModuleVersion[] = [
  { id: 'v1', module_id: 'm-1', version: '1.0.0', download_count: 10, deprecated: false },
]

function renderHeader(overrides: Partial<React.ComponentProps<typeof ModuleDetailHeader>> = {}) {
  const props = {
    module: baseModule,
    namespace: 'hashicorp',
    name: 'consul',
    system: 'aws',
    canManage: true,
    versions,
    selectedVersion: versions[0],
    onSelectVersion: vi.fn(),
    onPublishNewVersion: vi.fn(),
    onUpdateDescription: vi.fn(),
    onOpenDeprecateModuleDialog: vi.fn(),
    onOpenUndeprecateModuleDialog: vi.fn(),
    onOpenDeleteModuleDialog: vi.fn(),
    ...overrides,
  }
  render(
    <MemoryRouter>
      <ModuleDetailHeader {...props} />
    </MemoryRouter>,
  )
  return props
}

describe('ModuleDetailHeader', () => {
  it('renders the module name heading, breadcrumbs, and chips', () => {
    renderHeader()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('consul')
    expect(screen.getByText('Modules')).toBeInTheDocument()
    expect(screen.getByText('hashicorp/aws')).toBeInTheDocument()
    expect(screen.getByText('42 downloads')).toBeInTheDocument()
  })

  it('shows the deprecation banner with a successor link when module is deprecated', () => {
    renderHeader({
      module: {
        ...baseModule,
        deprecated: true,
        deprecation_message: 'use the v2 module',
        successor_module: { namespace: 'ns', name: 'nm', system: 'sys' },
      },
    })
    expect(screen.getByText(/This module is deprecated/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /ns\/nm\/\s*sys/ })).toHaveAttribute(
      'href',
      '/modules/ns/nm/sys',
    )
  })

  it('shows the Deprecated chip for a deprecated selected version', () => {
    renderHeader({
      selectedVersion: { ...versions[0], deprecated: true },
    })
    expect(screen.getByText('Deprecated')).toBeInTheDocument()
  })

  it('fires onPublishNewVersion and hides the button when user cannot manage', async () => {
    const props = renderHeader()
    await userEvent.click(screen.getByRole('button', { name: /publish new version/i }))
    expect(props.onPublishNewVersion).toHaveBeenCalled()
  })

  it('hides the publish button when canManage is false', () => {
    renderHeader({ canManage: false })
    expect(screen.queryByRole('button', { name: /publish new version/i })).not.toBeInTheDocument()
  })

  it('saves an edited description via the Enter key', async () => {
    const props = renderHeader()
    await userEvent.click(screen.getByLabelText(/edit description/i))
    const input = screen.getByPlaceholderText(/description/i)
    await userEvent.clear(input)
    await userEvent.type(input, 'new description{Enter}')
    expect(props.onUpdateDescription).toHaveBeenCalledWith('new description')
  })

  it('cancels description editing via Escape without saving', async () => {
    const props = renderHeader()
    await userEvent.click(screen.getByLabelText(/edit description/i))
    await userEvent.type(screen.getByPlaceholderText(/description/i), '{Escape}')
    expect(props.onUpdateDescription).not.toHaveBeenCalled()
    expect(screen.getByText('A consul module')).toBeInTheDocument()
  })
})
