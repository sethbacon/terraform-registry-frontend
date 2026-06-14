import { afterEach, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SuiteSwitcher } from './SuiteSwitcher'

function withQuery(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
}

afterEach(() => vi.restoreAllMocks())

it('renders nothing when no sibling', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ sibling: null }), { status: 200 }),
  )
  render(withQuery(<SuiteSwitcher />))
  expect(screen.queryByRole('button')).toBeNull()
})

it('renders a link when a sibling is active', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(
      JSON.stringify({
        sibling: {
          app: 'terraform-state-manager',
          state: 'active',
          publicUrl: 'https://tfstate.example.com',
        },
      }),
      { status: 200 },
    ),
  )
  render(withQuery(<SuiteSwitcher />))
  expect(
    await screen.findByRole('button', { name: /Open Terraform State Manager/i }),
  ).toBeInTheDocument()
})

it('warns the sibling opens in a new tab until a shared store is confirmed', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(
      JSON.stringify({
        sibling: {
          app: 'terraform-state-manager',
          state: 'active',
          publicUrl: 'https://tfstate.example.com',
        },
      }),
      { status: 200 },
    ),
  )
  render(withQuery(<SuiteSwitcher />))
  // No sharedStore flag → set expectations that a separate sign-in may be needed.
  expect(
    await screen.findByRole('button', { name: /you may need to sign in/i }),
  ).toBeInTheDocument()
})

it('drops the sign-in hint when the sibling reports a shared store', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(
      JSON.stringify({
        sibling: {
          app: 'terraform-state-manager',
          state: 'active',
          publicUrl: 'https://tfstate.example.com',
          sharedStore: true,
        },
      }),
      { status: 200 },
    ),
  )
  render(withQuery(<SuiteSwitcher />))
  expect(
    await screen.findByRole('button', { name: 'Open Terraform State Manager' }),
  ).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /sign in/i })).toBeNull()
})

it('renders nothing when sibling is degraded', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(
      JSON.stringify({
        sibling: {
          app: 'terraform-registry',
          state: 'degraded',
          publicUrl: 'https://registry.example.com',
        },
      }),
      { status: 200 },
    ),
  )
  render(withQuery(<SuiteSwitcher />))
  await new Promise((r) => setTimeout(r, 50))
  expect(screen.queryByRole('button')).toBeNull()
})

it('renders nothing when fetch fails', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 500 }))
  render(withQuery(<SuiteSwitcher />))
  await new Promise((r) => setTimeout(r, 50))
  expect(screen.queryByRole('button')).toBeNull()
})
