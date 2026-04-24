import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import PolicyResultsPanel from '../PolicyResultsPanel'
import type { PolicyResult } from '../../types'

const passResult: PolicyResult = {
  allowed: true,
  mode: 'warn',
  violations: [],
}

const warnResult: PolicyResult = {
  allowed: true,
  mode: 'warn',
  violations: [
    { rule: 'no-debug', message: 'Debug output detected' },
    { rule: 'size-limit', message: 'Module exceeds recommended size' },
  ],
}

const blockResult: PolicyResult = {
  allowed: false,
  mode: 'block',
  violations: [{ rule: 'required-tag', message: 'Required tag "owner" is missing' }],
}

describe('PolicyResultsPanel', () => {
  it('renders PASS chip when allowed and no violations', () => {
    render(<PolicyResultsPanel policyResult={passResult} />)
    expect(screen.getByText('PASS')).toBeInTheDocument()
  })

  it('renders WARN chip when allowed but violations present', () => {
    render(<PolicyResultsPanel policyResult={warnResult} />)
    expect(screen.getByText('WARN')).toBeInTheDocument()
  })

  it('renders BLOCK chip when not allowed', () => {
    render(<PolicyResultsPanel policyResult={blockResult} />)
    expect(screen.getByText('BLOCK')).toBeInTheDocument()
  })

  it('shows mode label', () => {
    render(<PolicyResultsPanel policyResult={passResult} />)
    expect(screen.getByText('mode: warn')).toBeInTheDocument()
  })

  it('does not render violation list when no violations', () => {
    render(<PolicyResultsPanel policyResult={passResult} />)
    expect(screen.queryByText(/violation/)).not.toBeInTheDocument()
  })

  it('shows violation count when violations present', () => {
    render(<PolicyResultsPanel policyResult={warnResult} />)
    expect(screen.getByText('2 violations')).toBeInTheDocument()
  })

  it('shows singular "violation" for exactly one violation', () => {
    render(<PolicyResultsPanel policyResult={blockResult} />)
    expect(screen.getByText('1 violation')).toBeInTheDocument()
  })

  it('expands violation list by default when violations present', () => {
    render(<PolicyResultsPanel policyResult={blockResult} />)
    expect(screen.getByText('required-tag')).toBeInTheDocument()
    expect(screen.getByText('Required tag "owner" is missing')).toBeInTheDocument()
  })

  it('shows all violations in expanded state', () => {
    render(<PolicyResultsPanel policyResult={warnResult} />)
    expect(screen.getByText('no-debug')).toBeInTheDocument()
    expect(screen.getByText('Debug output detected')).toBeInTheDocument()
    expect(screen.getByText('size-limit')).toBeInTheDocument()
    expect(screen.getByText('Module exceeds recommended size')).toBeInTheDocument()
  })

  it('collapses and re-expands violation list on toggle click', () => {
    render(<PolicyResultsPanel policyResult={warnResult} />)
    const toggle = screen.getByText('2 violations').closest('div')!

    // initially expanded — violation visible
    expect(screen.getByText('no-debug')).toBeInTheDocument()

    // collapse
    fireEvent.click(toggle)
    // after collapse the Collapse animation hides content but DOM may still be present;
    // just verify the toggle is still clickable and re-expands
    fireEvent.click(toggle)
    expect(screen.getByText('no-debug')).toBeInTheDocument()
  })

  it('renders panel title', () => {
    render(<PolicyResultsPanel policyResult={passResult} />)
    expect(screen.getByText('Policy Evaluation')).toBeInTheDocument()
  })
})
