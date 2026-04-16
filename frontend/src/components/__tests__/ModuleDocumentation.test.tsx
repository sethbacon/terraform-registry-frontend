import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import ModuleDocumentation from '../ModuleDocumentation'
import type { ModuleDoc } from '../../types'

describe('ModuleDocumentation', () => {
  it('returns null when loading', () => {
    const { container } = render(
      <ModuleDocumentation moduleDocs={null} docsLoading={true} />
    )
    expect(container.innerHTML).toBe('')
  })

  it('shows empty message when moduleDocs is null', () => {
    render(<ModuleDocumentation moduleDocs={null} docsLoading={false} />)
    expect(screen.getByText(/No inputs, outputs, or provider requirements/)).toBeInTheDocument()
  })

  it('shows empty message when all sections are empty', () => {
    const emptyDocs: ModuleDoc = {
      inputs: [],
      outputs: [],
      providers: [],
      requirements: null,
    }
    render(<ModuleDocumentation moduleDocs={emptyDocs} docsLoading={false} />)
    expect(screen.getByText(/No inputs, outputs, or provider requirements/)).toBeInTheDocument()
  })

  it('renders inputs table', () => {
    const docs: ModuleDoc = {
      inputs: [
        { name: 'vpc_id', type: 'string', description: 'VPC ID', required: true, default: undefined },
        { name: 'region', type: 'string', description: 'AWS region', required: false, default: 'us-east-1' },
      ],
      outputs: [],
      providers: [],
      requirements: null,
    }
    render(<ModuleDocumentation moduleDocs={docs} docsLoading={false} />)
    expect(screen.getByText('Inputs')).toBeInTheDocument()
    expect(screen.getByText('vpc_id')).toBeInTheDocument()
    expect(screen.getByText('region')).toBeInTheDocument()
    expect(screen.getByText('Yes')).toBeInTheDocument()
    expect(screen.getByText('No')).toBeInTheDocument()
  })

  it('renders outputs table', () => {
    const docs: ModuleDoc = {
      inputs: [],
      outputs: [
        { name: 'subnet_ids', description: 'List of subnet IDs', sensitive: false },
        { name: 'db_password', description: 'Database password', sensitive: true },
      ],
      providers: [],
      requirements: null,
    }
    render(<ModuleDocumentation moduleDocs={docs} docsLoading={false} />)
    expect(screen.getByText('Outputs')).toBeInTheDocument()
    expect(screen.getByText('subnet_ids')).toBeInTheDocument()
    expect(screen.getByText('db_password')).toBeInTheDocument()
    // "Sensitive" appears in both table header and chip
    expect(screen.getAllByText('Sensitive').length).toBeGreaterThanOrEqual(1)
  })

  it('renders provider requirements table', () => {
    const docs: ModuleDoc = {
      inputs: [],
      outputs: [],
      providers: [
        { name: 'aws', source: 'hashicorp/aws', version_constraints: '>= 5.0' },
      ],
      requirements: null,
    }
    render(<ModuleDocumentation moduleDocs={docs} docsLoading={false} />)
    expect(screen.getByText('Provider Requirements')).toBeInTheDocument()
    expect(screen.getByText('hashicorp/aws')).toBeInTheDocument()
    expect(screen.getByText('>= 5.0')).toBeInTheDocument()
  })

  it('renders terraform version requirement', () => {
    const docs: ModuleDoc = {
      inputs: [{ name: 'x', type: 'string', description: 'test', required: true, default: undefined }],
      outputs: [],
      providers: [],
      requirements: { required_version: '>= 1.5.0' },
    }
    render(<ModuleDocumentation moduleDocs={docs} docsLoading={false} />)
    expect(screen.getByText('Terraform Version Requirement')).toBeInTheDocument()
    expect(screen.getByText('>= 1.5.0')).toBeInTheDocument()
  })

  it('renders all sections together', () => {
    const docs: ModuleDoc = {
      inputs: [{ name: 'name', type: 'string', description: 'Name', required: true, default: undefined }],
      outputs: [{ name: 'id', description: 'Resource ID', sensitive: false }],
      providers: [{ name: 'aws', source: 'hashicorp/aws', version_constraints: '~> 5.0' }],
      requirements: { required_version: '>= 1.5.0' },
    }
    render(<ModuleDocumentation moduleDocs={docs} docsLoading={false} />)
    expect(screen.getByText('Inputs')).toBeInTheDocument()
    expect(screen.getByText('Outputs')).toBeInTheDocument()
    expect(screen.getByText('Provider Requirements')).toBeInTheDocument()
    expect(screen.getByText('Terraform Version Requirement')).toBeInTheDocument()
  })
})
