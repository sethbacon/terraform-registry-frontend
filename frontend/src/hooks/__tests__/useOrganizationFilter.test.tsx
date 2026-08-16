import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { useOrganizationFilter } from '../useOrganizationFilter'

/**
 * Renders the hook with a visible readout of both the selection and the live
 * URL, so every assertion below is about what a reload would actually restore
 * rather than about component state that happens to agree with it.
 */
function Harness() {
  const { organizationId, setOrganizationId } = useOrganizationFilter()
  const location = useLocation()
  return (
    <div>
      <span data-testid="value">{organizationId || '(unset)'}</span>
      <span data-testid="search">{location.search || '(empty)'}</span>
      <button onClick={() => setOrganizationId('org-2')}>pick</button>
      <button onClick={() => setOrganizationId('')}>clear</button>
    </div>
  )
}

function renderHarness(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Harness />
    </MemoryRouter>,
  )
}

describe('useOrganizationFilter', () => {
  it('defaults to unset when the URL carries no organization', () => {
    renderHarness('/admin/apikeys')
    expect(screen.getByTestId('value')).toHaveTextContent('(unset)')
  })

  // The persistence decision itself: the selection lives in the URL, which is
  // what makes a filtered view survive a reload AND be linkable. Reading it
  // back out of location.search is the part localStorage could not satisfy.
  it('reads the selected organization from the URL', () => {
    renderHarness('/admin/apikeys?org=org-7')
    expect(screen.getByTestId('value')).toHaveTextContent('org-7')
  })

  it('writes the selected organization to the URL', async () => {
    renderHarness('/admin/apikeys')
    await userEvent.click(screen.getByText('pick'))
    expect(screen.getByTestId('search')).toHaveTextContent('org=org-2')
    expect(screen.getByTestId('value')).toHaveTextContent('org-2')
  })

  // Clearing must DELETE the parameter, not set it to empty. A lingering `org=`
  // is a present-but-empty selection that a future reader could take for one,
  // and it makes the "everything the caller may see" URL untidy in a way that
  // invites exactly that misreading.
  it('removes the parameter entirely when cleared, rather than emptying it', async () => {
    renderHarness('/admin/apikeys?org=org-7')
    await userEvent.click(screen.getByText('clear'))
    expect(screen.getByTestId('value')).toHaveTextContent('(unset)')
    expect(screen.getByTestId('search')).toHaveTextContent('(empty)')
  })

  // The page's other query parameters are not this hook's to discard.
  it('preserves the page other query parameters when changing organization', async () => {
    renderHarness('/admin/apikeys?status=pending&page=3')
    await userEvent.click(screen.getByText('pick'))
    const search = screen.getByTestId('search').textContent ?? ''
    expect(search).toContain('status=pending')
    expect(search).toContain('page=3')
    expect(search).toContain('org=org-2')
  })

  it('preserves the page other query parameters when cleared', async () => {
    renderHarness('/admin/apikeys?status=pending&org=org-7')
    await userEvent.click(screen.getByText('clear'))
    const search = screen.getByTestId('search').textContent ?? ''
    expect(search).toContain('status=pending')
    expect(search).not.toContain('org=')
  })
})
