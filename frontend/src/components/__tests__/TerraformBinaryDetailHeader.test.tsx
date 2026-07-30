import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import TerraformBinaryDetailHeader from '../TerraformBinaryDetailHeader'
import type { PublicMirrorSummary } from '../../hooks/useTerraformBinaryDetail'

function renderHeader(config: PublicMirrorSummary | null, onBack = vi.fn()) {
  render(
    <MemoryRouter>
      <TerraformBinaryDetailHeader name="terraform" config={config} onBack={onBack} />
    </MemoryRouter>,
  )
  return onBack
}

describe('TerraformBinaryDetailHeader', () => {
  it('renders the mirror name as the page title', () => {
    renderHeader({ name: 'terraform', tool: 'terraform', description: null })
    expect(screen.getByRole('heading', { level: 4 })).toHaveTextContent('terraform')
  })

  it('labels the HashiCorp Terraform tool', () => {
    renderHeader({ name: 'terraform', tool: 'terraform', description: null })
    expect(screen.getByText('Terraform (HashiCorp)')).toBeInTheDocument()
  })

  it('labels the OpenTofu tool', () => {
    renderHeader({ name: 'tofu', tool: 'opentofu', description: null })
    expect(screen.getByText('OpenTofu')).toBeInTheDocument()
  })

  it('falls back to the raw tool name for custom tools', () => {
    renderHeader({ name: 'opa', tool: 'opa', description: null })
    expect(screen.getByText('opa')).toBeInTheDocument()
  })

  it('renders the description only when the config has one', () => {
    const { unmount } = render(
      <MemoryRouter>
        <TerraformBinaryDetailHeader
          name="terraform"
          config={{ name: 'terraform', tool: 'terraform', description: 'Official binary' }}
          onBack={vi.fn()}
        />
      </MemoryRouter>,
    )
    expect(screen.getByText('Official binary')).toBeInTheDocument()
    unmount()

    renderHeader({ name: 'terraform', tool: 'terraform', description: null })
    expect(screen.queryByText('Official binary')).not.toBeInTheDocument()
  })

  it('shows the mirror download URL hint', () => {
    const { container } = render(
      <MemoryRouter>
        <TerraformBinaryDetailHeader
          name="terraform"
          config={{ name: 'terraform', tool: 'terraform', description: null }}
          onBack={vi.fn()}
        />
      </MemoryRouter>,
    )
    expect(container.querySelector('code')?.textContent).toContain(
      '/terraform/binaries/terraform/versions/{version}/{os}/{arch}',
    )
  })

  it('calls onBack when the back button is pressed', async () => {
    const onBack = renderHeader({ name: 'terraform', tool: 'terraform', description: null })
    await userEvent.click(screen.getByRole('button', { name: /back to binaries/i }))
    expect(onBack).toHaveBeenCalled()
  })
})
