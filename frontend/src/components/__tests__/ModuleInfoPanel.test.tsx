import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import ModuleInfoPanel from '../ModuleInfoPanel'
import type { Module, ModuleVersion } from '../../types'

const baseModule: Module = {
  id: 'm-1',
  namespace: 'hashicorp',
  name: 'consul',
  system: 'aws',
  download_count: 42,
  organization_name: 'Acme',
  created_by_name: 'alice',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
}

const versions: ModuleVersion[] = [
  { id: 'v2', module_id: 'm-1', version: '2.0.0', download_count: 5, deprecated: true },
  { id: 'v1', module_id: 'm-1', version: '1.0.0', download_count: 10, deprecated: false },
]

function renderPanel(overrides: Partial<React.ComponentProps<typeof ModuleInfoPanel>> = {}) {
  const props = {
    module: baseModule,
    namespace: 'hashicorp',
    name: 'consul',
    system: 'aws',
    versions,
    canManage: true,
    onUpdateNamespace: vi.fn(),
    ...overrides,
  }
  render(<ModuleInfoPanel {...props} />)
  return props
}

describe('ModuleInfoPanel', () => {
  it('renders namespace, name, provider, organization, and creator rows', () => {
    renderPanel()
    expect(screen.getByText('hashicorp')).toBeInTheDocument()
    expect(screen.getByText('consul')).toBeInTheDocument()
    expect(screen.getByText('aws')).toBeInTheDocument()
    expect(screen.getByText('Acme')).toBeInTheDocument()
    expect(screen.getByText('alice')).toBeInTheDocument()
  })

  it('reports the latest non-deprecated version', () => {
    renderPanel()
    expect(screen.getByText('1.0.0')).toBeInTheDocument()
  })

  it('falls back to the first version when all are deprecated, and N/A when none exist', () => {
    renderPanel({ versions: [{ ...versions[0] }] })
    expect(screen.getByText('2.0.0')).toBeInTheDocument()
  })

  it('shows N/A when there are no versions', () => {
    renderPanel({ versions: [] })
    expect(screen.getByText('N/A')).toBeInTheDocument()
  })

  it('saves an edited namespace via the Enter key', async () => {
    const props = renderPanel()
    await userEvent.click(screen.getByLabelText(/edit namespace/i))
    const input = screen.getByPlaceholderText(/namespace/i)
    await userEvent.clear(input)
    await userEvent.type(input, 'neworg{Enter}')
    expect(props.onUpdateNamespace).toHaveBeenCalledWith('neworg')
  })

  it('does not save a blank namespace', async () => {
    const props = renderPanel()
    await userEvent.click(screen.getByLabelText(/edit namespace/i))
    const input = screen.getByPlaceholderText(/namespace/i)
    await userEvent.clear(input)
    await userEvent.type(input, '   {Enter}')
    expect(props.onUpdateNamespace).not.toHaveBeenCalled()
  })

  it('hides the namespace edit affordance when user cannot manage', () => {
    renderPanel({ canManage: false })
    expect(screen.queryByLabelText(/edit namespace/i)).not.toBeInTheDocument()
  })
})
