import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import AdminBreadcrumbs, { buildAdminBreadcrumbs } from '../AdminBreadcrumbs'

describe('buildAdminBreadcrumbs', () => {
  it('returns empty array for non-admin routes', () => {
    expect(buildAdminBreadcrumbs('/')).toEqual([])
    expect(buildAdminBreadcrumbs('/modules')).toEqual([])
    expect(buildAdminBreadcrumbs('/providers/hashicorp/aws')).toEqual([])
  })

  it('returns just the dashboard for /admin', () => {
    const crumbs = buildAdminBreadcrumbs('/admin')
    expect(crumbs).toEqual([{ label: 'Dashboard', to: undefined }])
  })

  it('links intermediate crumbs and leaves the final one as plain text', () => {
    const crumbs = buildAdminBreadcrumbs('/admin/users')
    expect(crumbs).toEqual([
      { label: 'Dashboard', to: '/admin' },
      { label: 'Users', to: undefined },
    ])
  })

  it('handles multi-segment admin paths', () => {
    const crumbs = buildAdminBreadcrumbs('/admin/upload/module')
    expect(crumbs).toEqual([
      { label: 'Dashboard', to: '/admin' },
      { label: 'Upload', to: '/admin/upload' },
      { label: 'Module', to: undefined },
    ])
  })

  it('uses friendly labels for hyphenated segments', () => {
    const crumbs = buildAdminBreadcrumbs('/admin/audit-logs')
    expect(crumbs.map((c) => c.label)).toEqual(['Dashboard', 'Audit Logs'])
  })
})

describe('AdminBreadcrumbs', () => {
  function renderAt(path: string) {
    return render(
      <MemoryRouter initialEntries={[path]}>
        <AdminBreadcrumbs />
      </MemoryRouter>,
    )
  }

  it('renders nothing on non-admin routes', () => {
    const { container } = renderAt('/modules')
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when only the dashboard would appear (single crumb)', () => {
    const { container } = renderAt('/admin')
    expect(container).toBeEmptyDOMElement()
  })

  it('renders trail with linked Dashboard and plain current page', () => {
    renderAt('/admin/audit-logs')
    expect(screen.getByTestId('admin-breadcrumbs')).toBeInTheDocument()
    const dashboard = screen.getByRole('link', { name: 'Dashboard' })
    expect(dashboard).toHaveAttribute('href', '/admin')
    expect(screen.getByText('Audit Logs')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Audit Logs' })).not.toBeInTheDocument()
  })

  it('renders nested paths with all intermediate links', () => {
    renderAt('/admin/upload/module')
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/admin')
    expect(screen.getByRole('link', { name: 'Upload' })).toHaveAttribute('href', '/admin/upload')
    expect(screen.getByText('Module')).toBeInTheDocument()
  })
})
