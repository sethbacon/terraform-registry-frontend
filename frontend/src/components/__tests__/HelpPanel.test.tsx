import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'

// Mock the HelpContext
const mockCloseHelp = vi.fn()
vi.mock('../../contexts/HelpContext', () => ({
  useHelp: () => ({
    helpOpen: true,
    closeHelp: mockCloseHelp,
  }),
}))

// Import after mock
import HelpPanel, { HELP_PANEL_WIDTH } from '../HelpPanel'

function renderAtPath(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <HelpPanel />
    </MemoryRouter>,
  )
}

describe('HELP_PANEL_WIDTH', () => {
  it('is 320', () => {
    expect(HELP_PANEL_WIDTH).toBe(320)
  })
})

describe('HelpPanel', () => {
  it('renders home help for /', () => {
    renderAtPath('/')
    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.getByText(/home page provides a quick-start overview/)).toBeInTheDocument()
  })

  it('renders modules help for /modules', () => {
    renderAtPath('/modules')
    expect(screen.getByText('Modules')).toBeInTheDocument()
    expect(screen.getByText(/Lists all Terraform modules/)).toBeInTheDocument()
  })

  it('renders module detail help for parameterized module routes', () => {
    renderAtPath('/modules/hashicorp/consul/aws')
    expect(screen.getByText('Module Detail')).toBeInTheDocument()
  })

  it('renders providers help for /providers', () => {
    renderAtPath('/providers')
    expect(screen.getByText('Providers')).toBeInTheDocument()
  })

  it('renders provider detail help for parameterized provider routes', () => {
    renderAtPath('/providers/hashicorp/aws')
    expect(screen.getByText('Provider Detail')).toBeInTheDocument()
  })

  it('renders terraform binaries help', () => {
    renderAtPath('/terraform-binaries')
    expect(screen.getByText('Terraform Binary Mirrors')).toBeInTheDocument()
  })

  it('renders terraform binary detail help for parameterized route', () => {
    renderAtPath('/terraform-binaries/terraform')
    expect(screen.getByText('Binary Mirror Detail')).toBeInTheDocument()
  })

  it('renders API docs help', () => {
    renderAtPath('/api-docs')
    expect(screen.getByText('API Reference')).toBeInTheDocument()
  })

  it('renders dashboard help for /admin', () => {
    renderAtPath('/admin')
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })

  it('renders users help', () => {
    renderAtPath('/admin/users')
    expect(screen.getByText('Users')).toBeInTheDocument()
  })

  it('renders organizations help', () => {
    renderAtPath('/admin/organizations')
    expect(screen.getByText('Organizations')).toBeInTheDocument()
  })

  it('renders roles help', () => {
    renderAtPath('/admin/roles')
    expect(screen.getByText('Roles & Permissions')).toBeInTheDocument()
  })

  it('renders OIDC help', () => {
    renderAtPath('/admin/oidc')
    expect(screen.getByText('OIDC Groups')).toBeInTheDocument()
  })

  it('renders API keys help', () => {
    renderAtPath('/admin/apikeys')
    expect(screen.getByText('API Keys')).toBeInTheDocument()
  })

  it('renders upload help', () => {
    renderAtPath('/admin/upload')
    expect(screen.getByText('Upload')).toBeInTheDocument()
  })

  it('renders SCM providers help', () => {
    renderAtPath('/admin/scm-providers')
    expect(screen.getByText('SCM Providers')).toBeInTheDocument()
  })

  it('renders mirrors help', () => {
    renderAtPath('/admin/mirrors')
    expect(screen.getByText('Provider Mirrors')).toBeInTheDocument()
  })

  it('renders storage help', () => {
    renderAtPath('/admin/storage')
    expect(screen.getByText('Storage')).toBeInTheDocument()
  })

  it('renders audit logs help', () => {
    renderAtPath('/admin/audit-logs')
    expect(screen.getByText('Audit Logs')).toBeInTheDocument()
  })

  it('renders terraform mirror help', () => {
    renderAtPath('/admin/terraform-mirror')
    expect(screen.getByText('Terraform Binary Mirror')).toBeInTheDocument()
  })

  it('renders approvals help', () => {
    renderAtPath('/admin/approvals')
    expect(screen.getByText('Approval Requests')).toBeInTheDocument()
  })

  it('renders mirror policies help', () => {
    renderAtPath('/admin/policies')
    expect(screen.getByText('Mirror Policies')).toBeInTheDocument()
  })

  it('renders default help for unknown paths', () => {
    renderAtPath('/some/unknown/path')
    expect(screen.getByText('Help')).toBeInTheDocument()
    expect(screen.getByText(/Navigate to a page/)).toBeInTheDocument()
  })

  it('shows action headings', () => {
    renderAtPath('/modules')
    expect(screen.getByText('Search')).toBeInTheDocument()
    expect(screen.getByText('View Module')).toBeInTheDocument()
    expect(screen.getByText('Upload a Module')).toBeInTheDocument()
  })

  it('shows close button', () => {
    renderAtPath('/')
    expect(screen.getByLabelText('Close help panel')).toBeInTheDocument()
  })

  it('calls closeHelp when close button is clicked', async () => {
    const user = userEvent.setup()
    renderAtPath('/')
    await user.click(screen.getByLabelText('Close help panel'))
    expect(mockCloseHelp).toHaveBeenCalled()
  })

  it('shows API Docs footer link', () => {
    renderAtPath('/')
    expect(screen.getByText('API Docs')).toBeInTheDocument()
  })

  it('shows "What you can do" section', () => {
    renderAtPath('/')
    expect(screen.getByText('What you can do')).toBeInTheDocument()
  })
})
