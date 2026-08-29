import { render, screen, waitFor, waitForElementToBeRemoved, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { AxiosError } from 'axios'

// --- Mocks (must be before the component import) ---

const listPlatformAdminsMock = vi.fn()
const grantPlatformAdminMock = vi.fn()
const revokePlatformAdminMock = vi.fn()
const listUsersMock = vi.fn()

vi.mock('../../../services/api', () => ({
  default: {
    listPlatformAdmins: (...args: unknown[]) => listPlatformAdminsMock(...args),
    grantPlatformAdmin: (...args: unknown[]) => grantPlatformAdminMock(...args),
    revokePlatformAdmin: (...args: unknown[]) => revokePlatformAdminMock(...args),
    listUsers: (...args: unknown[]) => listUsersMock(...args),
  },
}))

const ALICE_ID = '11111111-1111-4111-8111-111111111111'
const BOB_ID = '22222222-2222-4222-8222-222222222222'
const ORPHAN_ID = '33333333-3333-4333-8333-333333333333'
const DELETED_GRANTOR_ID = '44444444-4444-4444-8444-444444444444'
const CAROL_ID = '55555555-5555-4555-8555-555555555555'

// The signed-in operator is Bob, so his row is the self-revocation case.
const useAuthMock = vi.fn(() => ({
  user: { id: BOB_ID, email: 'bob@example.com', name: 'Bob Operator' },
  allowedScopes: ['admin'],
}))

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}))

import PlatformAdminsPage from '../PlatformAdminsPage'

// --- Fixtures ---

const alice = {
  user_id: ALICE_ID,
  email: 'alice@example.com',
  name: 'Alice Admin',
  user_resolved: true,
  granted_by: DELETED_GRANTOR_ID,
  granted_by_email: 'founder@example.com',
  granted_at: '2026-07-01T10:00:00Z',
  note: 'Runs the platform',
}

// Backfilled row: nobody granted it, so granted_by is null.
const bob = {
  user_id: BOB_ID,
  email: 'bob@example.com',
  name: 'Bob Operator',
  user_resolved: true,
  granted_by: null,
  granted_at: '2026-06-01T09:00:00Z',
  note: 'Backfilled from an admin-bearing role template',
}

// Orphan: the grant exists, the user does not. Its grantor is gone too, so
// granted_by is set but granted_by_email is absent.
const orphan = {
  user_id: ORPHAN_ID,
  user_resolved: false,
  granted_by: DELETED_GRANTOR_ID,
  granted_at: '2026-05-01T08:00:00Z',
  note: null,
}

const fakeUsers = {
  users: [
    { id: ALICE_ID, email: 'alice@example.com', name: 'Alice Admin' },
    { id: BOB_ID, email: 'bob@example.com', name: 'Bob Operator' },
    { id: CAROL_ID, email: 'carol@example.com', name: 'Carol Newcomer' },
  ],
  pagination: { page: 1, per_page: 100, total: 3, total_pages: 1 },
}

function axiosError(status: number, body: Record<string, unknown>): AxiosError {
  const err = new AxiosError('Request failed')
  err.response = {
    status,
    statusText: '',
    headers: {},
    config: {} as never,
    data: body,
  }
  return err
}

function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
}

function renderPage() {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter>
        <PlatformAdminsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

/** The table row containing `text`, once the listing has rendered. */
async function rowContaining(text: string): Promise<HTMLElement> {
  const cell = await screen.findByText(text)
  const row = cell.closest('tr')
  if (!row) throw new Error(`no table row contains "${text}"`)
  return row
}

describe('PlatformAdminsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthMock.mockReturnValue({
      user: { id: BOB_ID, email: 'bob@example.com', name: 'Bob Operator' },
      allowedScopes: ['admin'],
    })
    listUsersMock.mockResolvedValue(fakeUsers)
  })

  it('shows a loading spinner while the grants load', () => {
    listPlatformAdminsMock.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('renders the page header once loaded', async () => {
    listPlatformAdminsMock.mockResolvedValue([alice, bob])
    renderPage()
    expect(await screen.findByText('Platform Administrators')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Platform-admin authority is held by an explicit grant, not by a role template. Every grant records who granted it, when, and why.',
      ),
    ).toBeInTheDocument()
  })

  it('surfaces the backend error message when the list fails to load', async () => {
    listPlatformAdminsMock.mockRejectedValue(
      axiosError(500, { error: 'Failed to resolve platform administrator identities' }),
    )
    renderPage()
    expect(
      await screen.findByText('Failed to resolve platform administrator identities'),
    ).toBeInTheDocument()
  })

  it('shows the empty state when no grant exists', async () => {
    listPlatformAdminsMock.mockResolvedValue([])
    renderPage()
    expect(await screen.findByText('No platform-admin grants exist yet.')).toBeInTheDocument()
  })

  // --- Behaviour 2: provenance is the point of the table ---

  it('renders each grant with its holder, grantor, moment and note', async () => {
    listPlatformAdminsMock.mockResolvedValue([alice, bob])
    renderPage()

    const aliceRow = within(await rowContaining('Alice Admin'))
    expect(aliceRow.getByText('alice@example.com')).toBeInTheDocument()
    expect(aliceRow.getByText('founder@example.com')).toBeInTheDocument()
    expect(
      aliceRow.getByText(new Date('2026-07-01T10:00:00Z').toLocaleString()),
    ).toBeInTheDocument()
    expect(aliceRow.getByText('Runs the platform')).toBeInTheDocument()
  })

  it('names the backfill as the grantor when granted_by is null', async () => {
    listPlatformAdminsMock.mockResolvedValue([alice, bob])
    renderPage()

    const bobRow = within(await rowContaining('Bob Operator'))
    expect(bobRow.getByText('System backfill')).toBeInTheDocument()
    expect(bobRow.getByText('Backfilled from an admin-bearing role template')).toBeInTheDocument()
  })

  it('says the grantor was deleted when granted_by has no address', async () => {
    listPlatformAdminsMock.mockResolvedValue([alice, orphan])
    renderPage()

    const orphanRow = within(await rowContaining('User no longer exists'))
    expect(orphanRow.getByText(`Deleted user (${DELETED_GRANTOR_ID})`)).toBeInTheDocument()
  })

  it('marks a grant with no note rather than leaving the cell blank', async () => {
    listPlatformAdminsMock.mockResolvedValue([alice, orphan])
    renderPage()

    const orphanRow = within(await rowContaining('User no longer exists'))
    expect(orphanRow.getByText('No note recorded')).toBeInTheDocument()
  })

  // --- Behaviour 3: an orphaned grant is a real state, not a blank name ---

  it('renders an orphaned grant as "grant exists, user does not" with its user id', async () => {
    listPlatformAdminsMock.mockResolvedValue([alice, bob, orphan])
    renderPage()

    const orphanRow = within(await rowContaining('User no longer exists'))
    expect(orphanRow.getByText(ORPHAN_ID)).toBeInTheDocument()
    expect(
      orphanRow.getByText('Grant confers no access — sign-in resolves the user first.'),
    ).toBeInTheDocument()
  })

  it('summarises how many grants are orphaned and that they are not administrators', async () => {
    listPlatformAdminsMock.mockResolvedValue([alice, bob, orphan])
    renderPage()

    expect(
      await screen.findByText(
        '1 grant refers to a user who no longer exists. It confers no access and does not count as a remaining administrator, but it is listed here so you can remove it.',
      ),
    ).toBeInTheDocument()
  })

  it('shows no orphan summary when every grant resolves', async () => {
    listPlatformAdminsMock.mockResolvedValue([alice, bob])
    renderPage()

    await screen.findByText('Alice Admin')
    expect(screen.queryByText(/refers? to a user who no longer exists/)).not.toBeInTheDocument()
  })

  it('marks the signed-in operator’s own grant', async () => {
    listPlatformAdminsMock.mockResolvedValue([alice, bob])
    renderPage()

    const bobRow = within(await rowContaining('Bob Operator'))
    expect(bobRow.getByText('You')).toBeInTheDocument()
    expect(within(await rowContaining('Alice Admin')).queryByText('You')).not.toBeInTheDocument()
  })

  // --- Granting ---

  it('grants platform admin to a user who does not already hold it', async () => {
    listPlatformAdminsMock.mockResolvedValue([alice, bob])
    grantPlatformAdminMock.mockResolvedValue({
      user_id: CAROL_ID,
      email: 'carol@example.com',
      name: 'Carol Newcomer',
      user_resolved: true,
      granted_by: BOB_ID,
      granted_by_email: 'bob@example.com',
      granted_at: '2026-08-01T12:00:00Z',
      note: 'On call rotation',
    })
    renderPage()
    await screen.findByText('Alice Admin')

    await userEvent.click(screen.getByRole('button', { name: 'Grant platform admin' }))
    const dialog = await screen.findByRole('dialog')

    // The refetch after the grant must return CHANGED rows, or react-query's
    // structural sharing hands back the identical list and the assertion below
    // would pass even if the invalidation never happened.
    listPlatformAdminsMock.mockResolvedValue([
      alice,
      bob,
      {
        user_id: CAROL_ID,
        email: 'carol@example.com',
        name: 'Carol Newcomer',
        user_resolved: true,
        granted_by: BOB_ID,
        granted_by_email: 'bob@example.com',
        granted_at: '2026-08-01T12:00:00Z',
        note: 'On call rotation',
      },
    ])

    await userEvent.click(within(dialog).getByRole('combobox', { name: 'User' }))
    await userEvent.click(await screen.findByText('Carol Newcomer (carol@example.com)'))
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Note' }), 'On call rotation')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Grant' }))

    await waitFor(() =>
      expect(grantPlatformAdminMock).toHaveBeenCalledWith({
        user_id: CAROL_ID,
        note: 'On call rotation',
      }),
    )
    expect(
      await screen.findByText('Granted platform admin to carol@example.com.'),
    ).toBeInTheDocument()
    // The table reflects the new grant, which proves the list was invalidated.
    expect(await screen.findByText('Carol Newcomer')).toBeInTheDocument()
  })

  it('omits the note entirely when the operator left it blank', async () => {
    listPlatformAdminsMock.mockResolvedValue([alice, bob])
    grantPlatformAdminMock.mockResolvedValue({
      user_id: CAROL_ID,
      email: 'carol@example.com',
      name: 'Carol Newcomer',
      user_resolved: true,
      granted_by: BOB_ID,
      granted_at: '2026-08-01T12:00:00Z',
      note: null,
    })
    renderPage()
    await screen.findByText('Alice Admin')

    await userEvent.click(screen.getByRole('button', { name: 'Grant platform admin' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('combobox', { name: 'User' }))
    await userEvent.click(await screen.findByText('Carol Newcomer (carol@example.com)'))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Grant' }))

    await waitFor(() => expect(grantPlatformAdminMock).toHaveBeenCalledWith({ user_id: CAROL_ID }))
  })

  it('does not offer users who already hold a grant', async () => {
    listPlatformAdminsMock.mockResolvedValue([alice, bob])
    renderPage()
    await screen.findByText('Alice Admin')

    await userEvent.click(screen.getByRole('button', { name: 'Grant platform admin' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('combobox', { name: 'User' }))

    expect(await screen.findByText('Carol Newcomer (carol@example.com)')).toBeInTheDocument()
    expect(screen.queryByText('Alice Admin (alice@example.com)')).not.toBeInTheDocument()
    expect(screen.queryByText('Bob Operator (bob@example.com)')).not.toBeInTheDocument()
  })

  it('refuses a note longer than the backend accepts, without calling the API', async () => {
    listPlatformAdminsMock.mockResolvedValue([alice, bob])
    renderPage()
    await screen.findByText('Alice Admin')

    await userEvent.click(screen.getByRole('button', { name: 'Grant platform admin' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('combobox', { name: 'User' }))
    await userEvent.click(await screen.findByText('Carol Newcomer (carol@example.com)'))

    const note = within(dialog).getByRole('textbox', { name: 'Note' })
    await userEvent.click(note)
    await userEvent.paste('x'.repeat(501))

    expect(
      await within(dialog).findByText('The note must be at most 500 characters.'),
    ).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Grant' })).toBeDisabled()
    expect(grantPlatformAdminMock).not.toHaveBeenCalled()
  })

  it('reports the backend refusal when the user already holds the grant', async () => {
    listPlatformAdminsMock.mockResolvedValue([alice, bob])
    grantPlatformAdminMock.mockRejectedValue(
      axiosError(409, { error: 'User already holds platform-admin' }),
    )
    renderPage()
    await screen.findByText('Alice Admin')

    await userEvent.click(screen.getByRole('button', { name: 'Grant platform admin' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('combobox', { name: 'User' }))
    await userEvent.click(await screen.findByText('Carol Newcomer (carol@example.com)'))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Grant' }))

    expect(await screen.findByText('User already holds platform-admin')).toBeInTheDocument()
  })

  // --- Revoking ---

  it('revokes another administrator after confirmation', async () => {
    listPlatformAdminsMock.mockResolvedValue([alice, bob])
    revokePlatformAdminMock.mockResolvedValue({ message: 'Platform administrator revoked' })
    renderPage()
    await screen.findByText('Alice Admin')

    await userEvent.click(
      screen.getByRole('button', { name: 'Revoke platform admin from alice@example.com' }),
    )
    const dialog = await screen.findByRole('dialog')
    expect(
      within(dialog).getByText('Remove platform-admin authority from alice@example.com?'),
    ).toBeInTheDocument()
    expect(
      within(dialog).getByText('The revocation is recorded in the audit trail with your name.'),
    ).toBeInTheDocument()

    // Changed refetch: Alice's row is gone afterwards.
    listPlatformAdminsMock.mockResolvedValue([bob])
    await userEvent.click(within(dialog).getByRole('button', { name: 'Revoke' }))

    await waitFor(() => expect(revokePlatformAdminMock).toHaveBeenCalledWith(ALICE_ID))
    expect(
      await screen.findByText('Revoked platform admin from alice@example.com.'),
    ).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('Alice Admin')).not.toBeInTheDocument())
  })

  it('closes the confirmation without revoking when cancelled', async () => {
    listPlatformAdminsMock.mockResolvedValue([alice, bob])
    renderPage()
    await screen.findByText('Alice Admin')

    await userEvent.click(
      screen.getByRole('button', { name: 'Revoke platform admin from alice@example.com' }),
    )
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    // MUI keeps a closing Dialog mounted through its exit transition, so
    // queryByRole('dialog') passes whether or not the close happened.
    await waitForElementToBeRemoved(() => screen.queryByRole('dialog'))
    expect(revokePlatformAdminMock).not.toHaveBeenCalled()
  })

  // --- Behaviour 4: self-revocation is allowed, and confirmed ---

  it('warns that a self-revocation removes the operator’s own access', async () => {
    listPlatformAdminsMock.mockResolvedValue([alice, bob])
    revokePlatformAdminMock.mockResolvedValue({ message: 'Platform administrator revoked' })
    renderPage()
    await screen.findByText('Bob Operator')

    await userEvent.click(
      screen.getByRole('button', { name: 'Revoke platform admin from bob@example.com' }),
    )
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('This is your own access')).toBeInTheDocument()
    expect(
      within(dialog).getByText(
        'You lose the admin scope as soon as this completes, including this page. Another platform administrator would have to grant it back.',
      ),
    ).toBeInTheDocument()

    listPlatformAdminsMock.mockResolvedValue([alice])
    await userEvent.click(within(dialog).getByRole('button', { name: 'Revoke my own access' }))

    await waitFor(() => expect(revokePlatformAdminMock).toHaveBeenCalledWith(BOB_ID))
  })

  it('does not warn about self-revocation when revoking someone else', async () => {
    listPlatformAdminsMock.mockResolvedValue([alice, bob])
    renderPage()
    await screen.findByText('Alice Admin')

    await userEvent.click(
      screen.getByRole('button', { name: 'Revoke platform admin from alice@example.com' }),
    )
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).queryByText('This is your own access')).not.toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Revoke' })).toBeInTheDocument()
  })

  // --- Behaviour 1: the last administrator is explained, not errored ---

  it('explains the never-zero invariant instead of offering to revoke the last administrator', async () => {
    // Only Bob resolves; the orphan grant is inert and does not count.
    listPlatformAdminsMock.mockResolvedValue([bob, orphan])
    renderPage()
    await screen.findByText('Bob Operator')

    await userEvent.click(
      screen.getByRole('button', { name: 'Revoke platform admin from bob@example.com' }),
    )
    const dialog = await screen.findByRole('dialog')

    expect(within(dialog).getByText('This is the last platform administrator')).toBeInTheDocument()
    expect(
      within(dialog).getByText(
        'A deployment with no platform administrator cannot be recovered through this API, so the registry refuses to remove the last one. Grant platform-admin to another user first, then revoke this one.',
      ),
    ).toBeInTheDocument()
    // Nothing to confirm: the only way out is to close.
    expect(within(dialog).queryByRole('button', { name: 'Revoke' })).not.toBeInTheDocument()
    expect(
      within(dialog).queryByRole('button', { name: 'Revoke my own access' }),
    ).not.toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Close' })).toBeInTheDocument()
    expect(revokePlatformAdminMock).not.toHaveBeenCalled()
  })

  it('still offers to revoke an orphaned grant while another administrator remains', async () => {
    listPlatformAdminsMock.mockResolvedValue([bob, orphan])
    revokePlatformAdminMock.mockResolvedValue({ message: 'Platform administrator revoked' })
    renderPage()
    await screen.findByText('User no longer exists')

    await userEvent.click(
      screen.getByRole('button', { name: `Revoke platform admin from ${ORPHAN_ID}` }),
    )
    const dialog = await screen.findByRole('dialog')
    expect(
      within(dialog).queryByText('This is the last platform administrator'),
    ).not.toBeInTheDocument()

    listPlatformAdminsMock.mockResolvedValue([bob])
    await userEvent.click(within(dialog).getByRole('button', { name: 'Revoke' }))

    await waitFor(() => expect(revokePlatformAdminMock).toHaveBeenCalledWith(ORPHAN_ID))
  })

  it('re-reads the listing when the grant is already gone (404)', async () => {
    // Somebody else revoked Alice between this client's last read and this click.
    // Before the 404 branch, the error was reported but the listing was NOT
    // invalidated, so Alice's row stayed in the table and stayed clickable -- the
    // next click repeated the same 404 against a row the server says is gone.
    listPlatformAdminsMock.mockResolvedValue([alice, bob])
    revokePlatformAdminMock.mockRejectedValue(
      axiosError(404, { error: 'User does not hold platform-admin' }),
    )
    renderPage()
    await screen.findByText('Alice Admin')

    await userEvent.click(
      screen.getByRole('button', { name: 'Revoke platform admin from alice@example.com' }),
    )
    const dialog = await screen.findByRole('dialog')
    // The refetch the invalidation triggers returns the server's truth: Alice is gone.
    listPlatformAdminsMock.mockResolvedValue([bob])
    await userEvent.click(within(dialog).getByRole('button', { name: 'Revoke' }))

    expect(await screen.findByText('User does not hold platform-admin')).toBeInTheDocument()
    // The stale row is gone, which only happens if the 404 invalidated the listing.
    await waitFor(() => expect(screen.queryByText('Alice Admin')).not.toBeInTheDocument())
  })

  it('turns the backend’s 409 into the same explanation, with no error banner', async () => {
    // Both rows resolve, so the client cannot know Alice's user was deleted
    // under it; only the backend can refuse.
    listPlatformAdminsMock.mockResolvedValue([alice, bob])
    revokePlatformAdminMock.mockRejectedValue(
      axiosError(409, {
        error: 'Cannot revoke the last platform administrator',
        details: 'Grant platform-admin to another user first',
      }),
    )
    renderPage()
    await screen.findByText('Bob Operator')

    await userEvent.click(
      screen.getByRole('button', { name: 'Revoke platform admin from bob@example.com' }),
    )
    const dialog = await screen.findByRole('dialog')
    // Changed refetch, but Alice still RESOLVES: the explanation below can
    // therefore only come from the server's 409, not from the client-side
    // last-administrator check, which still says there is another one.
    listPlatformAdminsMock.mockResolvedValue([{ ...alice, note: 'Note updated elsewhere' }, bob])
    await userEvent.click(within(dialog).getByRole('button', { name: 'Revoke my own access' }))

    expect(
      await within(dialog).findByText('This is the last platform administrator'),
    ).toBeInTheDocument()
    expect(
      within(dialog).queryByRole('button', { name: 'Revoke my own access' }),
    ).not.toBeInTheDocument()
    // Not a red toast: the operator did nothing wrong.
    expect(screen.queryByText('Failed to revoke platform admin')).not.toBeInTheDocument()
    expect(
      screen.queryByText('Cannot revoke the last platform administrator'),
    ).not.toBeInTheDocument()
    // The listing was refreshed, because the client's picture of who resolves
    // was evidently stale.
    expect(await screen.findByText('Note updated elsewhere')).toBeInTheDocument()
  })

  it('reports a genuine revoke failure as an error', async () => {
    listPlatformAdminsMock.mockResolvedValue([alice, bob])
    revokePlatformAdminMock.mockRejectedValue(
      axiosError(500, { error: 'Failed to verify remaining platform administrators' }),
    )
    renderPage()
    await screen.findByText('Alice Admin')

    await userEvent.click(
      screen.getByRole('button', { name: 'Revoke platform admin from alice@example.com' }),
    )
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Revoke' }))

    expect(
      await screen.findByText('Failed to verify remaining platform administrators'),
    ).toBeInTheDocument()
  })

  it('refetches the grants when Refresh is clicked', async () => {
    listPlatformAdminsMock.mockResolvedValue([alice, bob])
    renderPage()
    await screen.findByText('Alice Admin')

    listPlatformAdminsMock.mockClear()
    listPlatformAdminsMock.mockResolvedValue([alice])
    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }))

    await waitFor(() => expect(listPlatformAdminsMock).toHaveBeenCalled())
    await waitFor(() => expect(screen.queryByText('Bob Operator')).not.toBeInTheDocument())
  })
})
