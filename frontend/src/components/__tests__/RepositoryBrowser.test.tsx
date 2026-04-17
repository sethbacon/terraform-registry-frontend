import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const listSCMRepositoriesMock = vi.fn()

vi.mock('../../services/api', () => ({
  default: {
    listSCMRepositories: (...args: unknown[]) => listSCMRepositoriesMock(...args),
    listSCMTags: vi.fn().mockResolvedValue({ tags: [] }),
    listSCMBranches: vi.fn().mockResolvedValue({ branches: [] }),
  },
}))

import RepositoryBrowser from '../RepositoryBrowser'

describe('RepositoryBrowser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading spinner initially', () => {
    listSCMRepositoriesMock.mockReturnValue(new Promise(() => { }))
    render(<RepositoryBrowser providerId="scm-1" />)
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('shows empty message when no repos found', async () => {
    listSCMRepositoriesMock.mockResolvedValue({ repositories: [] })
    render(<RepositoryBrowser providerId="scm-1" />)
    const { waitFor } = await import('@testing-library/react')
    await waitFor(() => {
      expect(screen.getByText(/no repositories found/i)).toBeInTheDocument()
    })
  })
})
