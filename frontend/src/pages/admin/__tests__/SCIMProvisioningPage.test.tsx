import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

import SCIMProvisioningPage from '../SCIMProvisioningPage'

describe('SCIMProvisioningPage', () => {
  it('renders the SCIM Provisioning heading', () => {
    render(<SCIMProvisioningPage />)
    expect(screen.getByText('SCIM Provisioning')).toBeInTheDocument()
  })

  it('shows SCIM base URL with current origin', () => {
    render(<SCIMProvisioningPage />)
    const baseUrlField = screen.getByDisplayValue(new RegExp(`${window.location.origin}/scim/v2$`))
    expect(baseUrlField).toBeInTheDocument()
  })

  it('shows Users and Groups endpoint URLs', () => {
    render(<SCIMProvisioningPage />)
    expect(screen.getByDisplayValue(`${window.location.origin}/scim/v2/Users`)).toBeInTheDocument()
    expect(screen.getByDisplayValue(`${window.location.origin}/scim/v2/Groups`)).toBeInTheDocument()
  })

  it('shows authentication warning about storing API key securely', () => {
    render(<SCIMProvisioningPage />)
    expect(screen.getByText(/Store the API key securely/)).toBeInTheDocument()
  })

  it('shows bearer token scope info', () => {
    render(<SCIMProvisioningPage />)
    const matches = screen.getAllByText('scim:provision')
    expect(matches.length).toBeGreaterThanOrEqual(1)
  })

  it('shows supported operations section', () => {
    render(<SCIMProvisioningPage />)
    expect(screen.getByText('Supported Operations')).toBeInTheDocument()
    expect(screen.getByText(/List, Get, Create, Update/)).toBeInTheDocument()
  })
})
