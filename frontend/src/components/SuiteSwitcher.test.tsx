import { afterEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { AxiosResponse } from 'axios'
import { http } from '../services/api/http'
import { SuiteSwitcher } from './SuiteSwitcher'

function withQuery(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
}

// Minimal AxiosResponse stub — useSuite only reads `.data`.
function axiosResponse<T>(data: T): AxiosResponse<T> {
  return { data } as AxiosResponse<T>
}

afterEach(() => {
  vi.restoreAllMocks()
  window.name = ''
})

it('renders nothing when no sibling', async () => {
  vi.spyOn(http, 'get').mockResolvedValue(axiosResponse({ sibling: null }))
  render(withQuery(<SuiteSwitcher />))
  expect(screen.queryByRole('button')).toBeNull()
})

it('renders a link when a sibling is active', async () => {
  vi.spyOn(http, 'get').mockResolvedValue(
    axiosResponse({
      sibling: {
        app: 'terraform-state-manager',
        state: 'active',
        publicUrl: 'https://tfstate.example.com',
      },
    }),
  )
  render(withQuery(<SuiteSwitcher />))
  expect(
    await screen.findByRole('button', { name: /Open Terraform State Manager/i }),
  ).toBeInTheDocument()
})

it('warns the sibling opens in a new tab until a shared store is confirmed', async () => {
  vi.spyOn(http, 'get').mockResolvedValue(
    axiosResponse({
      sibling: {
        app: 'terraform-state-manager',
        state: 'active',
        publicUrl: 'https://tfstate.example.com',
      },
    }),
  )
  render(withQuery(<SuiteSwitcher />))
  // No sharedStore flag → set expectations that a separate sign-in may be needed.
  expect(
    await screen.findByRole('button', { name: /you may need to sign in/i }),
  ).toBeInTheDocument()
})

it('drops the sign-in hint when the sibling reports a shared store', async () => {
  vi.spyOn(http, 'get').mockResolvedValue(
    axiosResponse({
      sibling: {
        app: 'terraform-state-manager',
        state: 'active',
        publicUrl: 'https://tfstate.example.com',
        sharedStore: true,
      },
    }),
  )
  render(withQuery(<SuiteSwitcher />))
  expect(
    await screen.findByRole('button', { name: 'Open Terraform State Manager' }),
  ).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /sign in/i })).toBeNull()
})

it('reuses one sibling tab via a stable window name instead of opening a new one', async () => {
  // Same-origin sibling URL: the stable-name tab-reuse path only applies when the
  // sibling resolves to this app's own origin (SuiteSwitcher's isSameOrigin gate) —
  // cross-origin siblings always open via '_blank' + noopener,noreferrer instead.
  const siblingUrl = `${window.location.origin}/state-manager`
  vi.spyOn(http, 'get').mockResolvedValue(
    axiosResponse({
      sibling: {
        app: 'terraform-state-manager',
        state: 'active',
        publicUrl: siblingUrl,
      },
    }),
  )
  const focus = vi.fn()
  const openSpy = vi.spyOn(window, 'open').mockReturnValue({ focus } as unknown as Window)
  render(withQuery(<SuiteSwitcher />))
  fireEvent.click(await screen.findByRole('button', { name: /Open Terraform State Manager/i }))
  // Stable target name (the sibling app id) so the browser reuses that one tab;
  // .focus() brings it forward. NOT '_blank' (which spawns a new tab each click).
  // The opener relationship is severed via `opened.opener = null` afterward, not a
  // noopener flag (which would also drop the stable target name for this origin).
  expect(openSpy).toHaveBeenCalledWith(siblingUrl, 'terraform-state-manager')
  expect(focus).toHaveBeenCalled()
})

it('claims this tab under its own app id so the sibling reuses the original tab', async () => {
  // Same-origin sibling URL — see the previous test for why this matters.
  vi.spyOn(http, 'get').mockResolvedValue(
    axiosResponse({
      sibling: {
        app: 'terraform-state-manager',
        state: 'active',
        publicUrl: `${window.location.origin}/state-manager`,
      },
    }),
  )
  vi.spyOn(window, 'open').mockReturnValue({ focus: vi.fn() } as unknown as Window)
  render(withQuery(<SuiteSwitcher />))
  fireEvent.click(await screen.findByRole('button', { name: /Open Terraform State Manager/i }))
  // Self is the other known suite app; naming this tab lets the sibling's
  // switcher find and refocus it instead of spawning a third tab.
  expect(window.name).toBe('terraform-registry')
})

it('renders nothing when sibling is degraded', async () => {
  vi.spyOn(http, 'get').mockResolvedValue(
    axiosResponse({
      sibling: {
        app: 'terraform-registry',
        state: 'degraded',
        publicUrl: 'https://registry.example.com',
      },
    }),
  )
  render(withQuery(<SuiteSwitcher />))
  await new Promise((r) => setTimeout(r, 50))
  expect(screen.queryByRole('button')).toBeNull()
})

it('renders nothing when the config request fails', async () => {
  // With the shared http client, a non-2xx/3xx response (validateStatus in
  // http.ts) rejects rather than resolving with an !ok Response.
  vi.spyOn(http, 'get').mockRejectedValue(new Error('Request failed with status code 500'))
  render(withQuery(<SuiteSwitcher />))
  await new Promise((r) => setTimeout(r, 50))
  expect(screen.queryByRole('button')).toBeNull()
})
