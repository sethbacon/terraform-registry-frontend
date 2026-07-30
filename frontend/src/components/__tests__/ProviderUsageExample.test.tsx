import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import ProviderUsageExample from '../ProviderUsageExample'

describe('ProviderUsageExample', () => {
  it('renders the supplied HCL snippet', () => {
    render(
      <ProviderUsageExample
        example={'terraform {\n  required_providers {}\n}'}
        copied={false}
        onCopySource={vi.fn()}
      />,
    )
    expect(screen.getByText('Usage Example')).toBeInTheDocument()
    expect(screen.getByText(/required_providers/)).toBeInTheDocument()
  })

  it('calls onCopySource when the copy button is clicked', async () => {
    const onCopySource = vi.fn()
    render(
      <ProviderUsageExample example="terraform {}" copied={false} onCopySource={onCopySource} />,
    )
    await userEvent.click(screen.getByRole('button', { name: /copy source url/i }))
    expect(onCopySource).toHaveBeenCalled()
  })

  it('announces the copied state in the tooltip', async () => {
    render(<ProviderUsageExample example="terraform {}" copied onCopySource={vi.fn()} />)
    await userEvent.hover(screen.getByRole('button', { name: /copy source url/i }))
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Copied!')
  })
})
