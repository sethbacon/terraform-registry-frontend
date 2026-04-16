import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ProviderIcon, providerDisplayName } from '../ProviderIcon'

describe('providerDisplayName', () => {
  it('returns display name for known providers', () => {
    expect(providerDisplayName('aws')).toBe('AWS')
    expect(providerDisplayName('azurerm')).toBe('Azure')
    expect(providerDisplayName('google')).toBe('Google')
    expect(providerDisplayName('hashicorp')).toBe('HashiCorp')
    expect(providerDisplayName('vmware')).toBe('VMware')
    expect(providerDisplayName('oci')).toBe('Oracle Cloud')
  })

  it('is case-insensitive', () => {
    expect(providerDisplayName('AWS')).toBe('AWS')
    expect(providerDisplayName('Azurerm')).toBe('Azure')
    expect(providerDisplayName('GOOGLE')).toBe('Google')
  })

  it('title-cases unknown providers', () => {
    expect(providerDisplayName('custom')).toBe('Custom')
    expect(providerDisplayName('datadog')).toBe('Datadog')
  })

  it('handles single-char names', () => {
    expect(providerDisplayName('x')).toBe('X')
  })
})

describe('ProviderIcon', () => {
  it('returns null for unknown providers', () => {
    const { container } = render(<ProviderIcon provider="unknown-provider" />)
    expect(container.innerHTML).toBe('')
  })

  it('renders Font Awesome icon for aws', () => {
    render(<ProviderIcon provider="aws" />)
    const icon = screen.getByLabelText('AWS')
    expect(icon).toBeInTheDocument()
  })

  it('renders Font Awesome icon for azurerm', () => {
    render(<ProviderIcon provider="azurerm" />)
    expect(screen.getByLabelText('Azure')).toBeInTheDocument()
  })

  it('renders simple-icons SVG for hashicorp', () => {
    render(<ProviderIcon provider="hashicorp" />)
    const svg = screen.getByLabelText('HashiCorp')
    expect(svg).toBeInTheDocument()
    expect(svg.tagName.toLowerCase()).toBe('svg')
  })

  it('renders simple-icons SVG for google', () => {
    render(<ProviderIcon provider="google" />)
    expect(screen.getByLabelText('Google')).toBeInTheDocument()
  })

  it('renders simple-icons SVG for vsphere', () => {
    render(<ProviderIcon provider="vsphere" />)
    expect(screen.getByLabelText('VMware vSphere')).toBeInTheDocument()
  })

  it('renders avatar for oci', () => {
    render(<ProviderIcon provider="oci" />)
    const avatar = screen.getByLabelText('Oracle Cloud')
    expect(avatar).toBeInTheDocument()
    expect(avatar).toHaveTextContent('OCI')
  })

  it('renders avatar for oracle', () => {
    render(<ProviderIcon provider="oracle" />)
    const avatar = screen.getByLabelText('Oracle')
    expect(avatar).toBeInTheDocument()
    expect(avatar).toHaveTextContent('OC')
  })

  it('respects custom size prop', () => {
    render(<ProviderIcon provider="aws" size={48} />)
    const icon = screen.getByLabelText('AWS')
    expect(icon).toBeInTheDocument()
  })

  it('is case-insensitive', () => {
    render(<ProviderIcon provider="AWS" />)
    expect(screen.getByLabelText('AWS')).toBeInTheDocument()
  })

  it('renders azure alias same as azurerm', () => {
    render(<ProviderIcon provider="azure" />)
    expect(screen.getByLabelText('Azure')).toBeInTheDocument()
  })

  it('renders microsoft provider', () => {
    render(<ProviderIcon provider="microsoft" />)
    expect(screen.getByLabelText('Microsoft')).toBeInTheDocument()
  })

  it('renders googlecloud with simple-icons', () => {
    render(<ProviderIcon provider="googlecloud" />)
    const svg = screen.getByLabelText('Google Cloud')
    expect(svg.tagName.toLowerCase()).toBe('svg')
  })

  it('renders vcenter as VMware vCenter', () => {
    render(<ProviderIcon provider="vcenter" />)
    expect(screen.getByLabelText('VMware vCenter')).toBeInTheDocument()
  })
})
