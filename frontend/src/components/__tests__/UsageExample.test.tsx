import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import UsageExample from '../UsageExample'
import type { ModuleInputVar } from '../../types'

const required: ModuleInputVar[] = [
  { name: 'region', type: 'string', description: 'AWS region', default: undefined, required: true },
]

const baseProps = {
  registryHost: 'registry.example.com',
  namespace: 'hashicorp',
  name: 'vpc',
  system: 'aws',
  version: '1.2.3',
}

describe('UsageExample', () => {
  let writeText: ReturnType<typeof vi.fn>

  beforeEach(() => {
    localStorage.clear()
    writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
  })

  it('renders only the source tab when no required inputs are present', () => {
    render(<UsageExample {...baseProps} inputs={[]} />)
    expect(screen.queryByTestId('usage-example-tabs')).not.toBeInTheDocument()
    expect(screen.getByTestId('usage-example-code').textContent).toContain('source  =')
  })

  it('renders tabs when required inputs are present and switches content', () => {
    render(<UsageExample {...baseProps} inputs={required} />)
    expect(screen.getByTestId('usage-example-tabs')).toBeInTheDocument()
    expect(screen.getByTestId('usage-example-code').textContent).not.toContain('region =')

    fireEvent.click(screen.getByRole('tab', { name: /required inputs/i }))
    expect(screen.getByTestId('usage-example-code').textContent).toContain('region =')
  })

  it('persists tool preference to localStorage', () => {
    render(<UsageExample {...baseProps} inputs={[]} />)
    fireEvent.click(screen.getByRole('button', { name: 'OpenTofu' }))
    expect(localStorage.getItem('preferredTool')).toBe('opentofu')
  })

  it('reads the stored tool preference on mount', () => {
    localStorage.setItem('preferredTool', 'opentofu')
    render(<UsageExample {...baseProps} inputs={required} />)
    fireEvent.click(screen.getByRole('tab', { name: /required inputs/i }))
    expect(screen.getByText(/tofu apply/)).toBeInTheDocument()
  })

  it('copies the visible example and calls onCopied', async () => {
    const onCopied = vi.fn()
    render(<UsageExample {...baseProps} inputs={[]} onCopied={onCopied} />)
    fireEvent.click(screen.getByTestId('usage-example-copy'))
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(
        expect.stringContaining('registry.example.com/hashicorp/vpc/aws'),
      )
    })
    expect(onCopied).toHaveBeenCalled()
  })
})
