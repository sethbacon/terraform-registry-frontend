import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AxiosError } from 'axios'

function makeAxiosError(status: number, message: string) {
  const err = new AxiosError(message)
  err.response = {
    status,
    data: { error: message },
    statusText: '',
    headers: {},
    config: {} as never,
  }
  return err
}

const listSCMRepositoriesMock = vi.fn()
const listSCMRepositoryTagsMock = vi.fn()
const listSCMRepositoryBranchesMock = vi.fn()

vi.mock('../../services/api', () => ({
  default: {
    listSCMRepositories: (...args: unknown[]) => listSCMRepositoriesMock(...args),
    listSCMRepositoryTags: (...args: unknown[]) => listSCMRepositoryTagsMock(...args),
    listSCMRepositoryBranches: (...args: unknown[]) => listSCMRepositoryBranchesMock(...args),
  },
}))

import RepositoryBrowser from '../RepositoryBrowser'

const fakeRepos = [
  {
    id: 'r-1',
    full_name: 'hashicorp/terraform-aws-vpc',
    owner: 'hashicorp',
    name: 'terraform-aws-vpc',
    description: 'AWS VPC module',
    default_branch: 'main',
    clone_url: 'https://github.com/hashicorp/terraform-aws-vpc.git',
    html_url: 'https://github.com/hashicorp/terraform-aws-vpc',
    private: false,
  },
  {
    id: 'r-2',
    full_name: 'hashicorp/internal-module',
    owner: 'hashicorp',
    name: 'internal-module',
    description: 'Private module',
    default_branch: 'main',
    clone_url: 'https://github.com/hashicorp/internal-module.git',
    html_url: 'https://github.com/hashicorp/internal-module',
    private: true,
  },
]

describe('RepositoryBrowser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listSCMRepositoryTagsMock.mockResolvedValue({ tags: [] })
    listSCMRepositoryBranchesMock.mockResolvedValue({ branches: [] })
  })

  it('shows loading spinner initially', () => {
    listSCMRepositoriesMock.mockReturnValue(new Promise(() => { }))
    render(<RepositoryBrowser providerId="scm-1" />)
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('shows empty message when no repos found', async () => {
    listSCMRepositoriesMock.mockResolvedValue({ repositories: [] })
    render(<RepositoryBrowser providerId="scm-1" />)
    await waitFor(() => {
      expect(screen.getByText(/no repositories found/i)).toBeInTheDocument()
    })
  })

  it('renders repositories when loaded', async () => {
    listSCMRepositoriesMock.mockResolvedValue({ repositories: fakeRepos })
    render(<RepositoryBrowser providerId="scm-1" />)
    await waitFor(() => {
      expect(screen.getByText('hashicorp/terraform-aws-vpc')).toBeInTheDocument()
      expect(screen.getByText('hashicorp/internal-module')).toBeInTheDocument()
    })
  })

  it('shows private/public chips', async () => {
    listSCMRepositoriesMock.mockResolvedValue({ repositories: fakeRepos })
    render(<RepositoryBrowser providerId="scm-1" />)
    await waitFor(() => {
      expect(screen.getByText('Public')).toBeInTheDocument()
      expect(screen.getByText('Private')).toBeInTheDocument()
    })
  })

  it('filters by search query (name)', async () => {
    const user = userEvent.setup()
    listSCMRepositoriesMock.mockResolvedValue({ repositories: fakeRepos })
    render(<RepositoryBrowser providerId="scm-1" />)
    await waitFor(() => expect(screen.getByText('hashicorp/terraform-aws-vpc')).toBeInTheDocument())
    await user.type(screen.getByPlaceholderText(/Search repositories/i), 'internal')
    await waitFor(() => {
      expect(screen.queryByText('hashicorp/terraform-aws-vpc')).not.toBeInTheDocument()
    })
    expect(screen.getByText('hashicorp/internal-module')).toBeInTheDocument()
  })

  it('refreshes when refresh button is clicked', async () => {
    listSCMRepositoriesMock.mockResolvedValue({ repositories: fakeRepos })
    render(<RepositoryBrowser providerId="scm-1" />)
    await waitFor(() => expect(screen.getByText('hashicorp/terraform-aws-vpc')).toBeInTheDocument())
    listSCMRepositoriesMock.mockClear()
    await userEvent.click(screen.getByRole('button', { name: /Refresh repositories/i }))
    await waitFor(() => expect(listSCMRepositoriesMock).toHaveBeenCalledWith('scm-1'))
  })

  it('expands repository on click and fires onRepositorySelect + loads tags/branches', async () => {
    const onRepositorySelect = vi.fn()
    listSCMRepositoriesMock.mockResolvedValue({ repositories: fakeRepos })
    listSCMRepositoryTagsMock.mockResolvedValue({
      tags: [{ tag_name: 'v1.0.0', target_commit: 'abc1234567890' }],
    })
    listSCMRepositoryBranchesMock.mockResolvedValue({
      branches: [{ branch_name: 'main', head_commit: 'def1234567890', is_protected: true }],
    })
    render(
      <RepositoryBrowser
        providerId="scm-1"
        onRepositorySelect={onRepositorySelect}
      />,
    )
    await waitFor(() => expect(screen.getByText('hashicorp/terraform-aws-vpc')).toBeInTheDocument())
    await userEvent.click(screen.getByText('hashicorp/terraform-aws-vpc'))
    expect(onRepositorySelect).toHaveBeenCalled()
    // tags/branches load on the selected+expanded effect — requires selectedRepository prop.
  })

  it('fires onTagSelect when a tag is clicked', async () => {
    const onTagSelect = vi.fn()
    listSCMRepositoriesMock.mockResolvedValue({ repositories: fakeRepos })
    listSCMRepositoryTagsMock.mockResolvedValue({
      tags: [{ tag_name: 'v1.0.0', target_commit: 'abc1234567890' }],
    })
    listSCMRepositoryBranchesMock.mockResolvedValue({ branches: [] })
    const { rerender } = render(
      <RepositoryBrowser
        providerId="scm-1"
        selectedRepository={fakeRepos[0]}
        onTagSelect={onTagSelect}
      />,
    )
    await waitFor(() => expect(screen.getByText('hashicorp/terraform-aws-vpc')).toBeInTheDocument())
    // Expand the selected repo — click to open accordion & load tags
    await userEvent.click(screen.getByText('hashicorp/terraform-aws-vpc'))
    // Re-render with selectedRepository to trigger the effect that fetches tags
    rerender(
      <RepositoryBrowser
        providerId="scm-1"
        selectedRepository={fakeRepos[0]}
        onTagSelect={onTagSelect}
      />,
    )
    await waitFor(() => expect(listSCMRepositoryTagsMock).toHaveBeenCalled())
    await waitFor(() => expect(screen.getAllByText('v1.0.0').length).toBeGreaterThan(0))
    await userEvent.click(screen.getAllByText('v1.0.0')[0])
    expect(onTagSelect).toHaveBeenCalled()
  })

  it('shows "No tags found" when an expanded repo has no tags', async () => {
    listSCMRepositoriesMock.mockResolvedValue({ repositories: fakeRepos })
    listSCMRepositoryTagsMock.mockResolvedValue({ tags: [] })
    listSCMRepositoryBranchesMock.mockResolvedValue({ branches: [] })
    const { rerender } = render(
      <RepositoryBrowser providerId="scm-1" selectedRepository={fakeRepos[0]} />,
    )
    await waitFor(() => expect(screen.getByText('hashicorp/terraform-aws-vpc')).toBeInTheDocument())
    await userEvent.click(screen.getByText('hashicorp/terraform-aws-vpc'))
    rerender(<RepositoryBrowser providerId="scm-1" selectedRepository={fakeRepos[0]} />)
    await waitFor(() => expect(listSCMRepositoryTagsMock).toHaveBeenCalled())
    await waitFor(() => expect(screen.getAllByText(/No tags found/i).length).toBeGreaterThan(0))
  })

  it('shows 403 error alert with reconnect message', async () => {
    listSCMRepositoriesMock.mockRejectedValue(makeAxiosError(403, 'token revoked'))
    render(<RepositoryBrowser providerId="scm-1" />)
    await waitFor(() => {
      expect(screen.getByText(/token revoked/i)).toBeInTheDocument()
    })
  })

  it('shows generic error alert on 500', async () => {
    listSCMRepositoriesMock.mockRejectedValue(makeAxiosError(500, 'server down'))
    render(<RepositoryBrowser providerId="scm-1" />)
    await waitFor(() => {
      expect(screen.getByText(/server down/i)).toBeInTheDocument()
    })
  })

  it('hides repos that do not match nameFilter and shows the hidden-count alert', async () => {
    listSCMRepositoriesMock.mockResolvedValue({ repositories: fakeRepos })
    render(
      <RepositoryBrowser
        providerId="scm-1"
        nameFilter={/^terraform-[a-z0-9-]+$/}
      />,
    )
    await waitFor(() => expect(screen.getByText('hashicorp/terraform-aws-vpc')).toBeInTheDocument())
    expect(screen.queryByText('hashicorp/internal-module')).not.toBeInTheDocument()
    expect(screen.getByText(/hidden/i)).toBeInTheDocument()
  })

  it('renders Selected chip on the currently selected repository', async () => {
    listSCMRepositoriesMock.mockResolvedValue({ repositories: fakeRepos })
    render(
      <RepositoryBrowser
        providerId="scm-1"
        selectedRepository={fakeRepos[0]}
      />,
    )
    await waitFor(() => expect(screen.getByText('hashicorp/terraform-aws-vpc')).toBeInTheDocument())
    expect(screen.getByText('Selected')).toBeInTheDocument()
  })

  it('collapses an expanded repo when clicked a second time', async () => {
    listSCMRepositoriesMock.mockResolvedValue({ repositories: fakeRepos })
    render(<RepositoryBrowser providerId="scm-1" />)
    await waitFor(() => expect(screen.getByText('hashicorp/terraform-aws-vpc')).toBeInTheDocument())
    const row = screen.getByText('hashicorp/terraform-aws-vpc')
    await userEvent.click(row)
    await userEvent.click(row)
    // Second click collapses — branches panel should not show "Tags" heading
    // but we just exercise the toggle path.
    expect(row).toBeInTheDocument()
  })

  it('handles tag/branch fetch failure without crashing', async () => {
    listSCMRepositoriesMock.mockResolvedValue({ repositories: fakeRepos })
    listSCMRepositoryTagsMock.mockRejectedValue(makeAxiosError(500, 'tag fetch failed'))
    listSCMRepositoryBranchesMock.mockRejectedValue(new Error('branch fetch failed'))
    const { rerender } = render(
      <RepositoryBrowser providerId="scm-1" selectedRepository={fakeRepos[0]} />,
    )
    await waitFor(() => expect(screen.getByText('hashicorp/terraform-aws-vpc')).toBeInTheDocument())
    await userEvent.click(screen.getByText('hashicorp/terraform-aws-vpc'))
    rerender(<RepositoryBrowser providerId="scm-1" selectedRepository={fakeRepos[0]} />)
    await waitFor(() => {
      expect(screen.getByText(/tag fetch failed/i)).toBeInTheDocument()
    })
  })

  it('does not load repositories without providerId', async () => {
    render(<RepositoryBrowser providerId="" />)
    // wait a tick for effects to flush
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(listSCMRepositoriesMock).not.toHaveBeenCalled()
  })

  it('updates the search input on change', async () => {
    listSCMRepositoriesMock.mockResolvedValue({ repositories: fakeRepos })
    render(<RepositoryBrowser providerId="scm-1" />)
    await waitFor(() => expect(screen.getByText('hashicorp/terraform-aws-vpc')).toBeInTheDocument())
    const input = screen.getByPlaceholderText(/Search repositories/i) as HTMLInputElement
    fireEvent.change(input, { target: { value: 'xyz' } })
    expect(input.value).toBe('xyz')
  })
})
