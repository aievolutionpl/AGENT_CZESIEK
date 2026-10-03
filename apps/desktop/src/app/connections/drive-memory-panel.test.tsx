import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

import { I18nProvider } from '@/i18n'

import { DriveMemoryPanel } from './drive-memory-panel'

const owner = vi.hoisted(() => ({ connectionId: 'alpha', profile: 'work' }))
vi.mock('@/hooks/use-active-capability-scope', () => ({
  useActiveCapabilityScope: () => ({ scope: { ...owner }, scopeKey: `${owner.connectionId}::${owner.profile}` })
}))
vi.mock('@/store/notifications', () => ({ notify: vi.fn(), notifyError: vi.fn() }))

const status = (name: string) => ({
  connected: true,
  folders: [{ id: name, name }],
  indexed: 0,
  vault: { exists: true, path: '/vault' }
})

const view = (client: QueryClient) => (
  <QueryClientProvider client={client}>
    <I18nProvider configClient={null} initialLocale="pl">
      <DriveMemoryPanel />
    </I18nProvider>
  </QueryClientProvider>
)

afterEach(() => {
  cleanup()
  owner.connectionId = 'alpha'
  vi.unstubAllGlobals()
})

it('pins pending sync to its owner and stops scheduling steps after switching connection', async () => {
  let complete!: (value: unknown) => void

  const api = vi.fn(async (request: { path: string; connectionId?: string; profile?: string }) => {
    if (request.path.endsWith('/sync')) {
      return new Promise(resolve => {
        complete = resolve
      })
    }

    return status(request.connectionId ?? 'unscoped')
  })

  vi.stubGlobal('hermesDesktop', { api })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  const mounted = render(view(client))
  await screen.findByText('alpha')
  fireEvent.click(screen.getByRole('button', { name: 'Indeksuj teraz' }))
  await waitFor(() => expect(api.mock.calls.some(([r]) => r.path.endsWith('/sync'))).toBe(true))
  owner.connectionId = 'beta'
  mounted.rerender(view(client))
  await screen.findByText('beta')
  await act(async () => complete({ ...status('alpha'), processed: 1, remaining: 4, failed: 0 }))
  expect(screen.queryByText('alpha')).toBeNull()
  const calls = api.mock.calls.filter(([r]) => r.path.endsWith('/sync'))
  expect(calls).toHaveLength(1)
  expect(calls[0][0]).toMatchObject({ connectionId: 'alpha', profile: 'work' })
  client.clear()
})

it('offers retry after a failed read instead of claiming there are no folders', async () => {
  const api = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(status('Dokumenty'))
  vi.stubGlobal('hermesDesktop', { api })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  render(view(client))
  fireEvent.click(await screen.findByRole('button', { name: 'Spróbuj ponownie' }))
  await screen.findByText('Dokumenty')
  expect(screen.queryByText('Nie ma jeszcze folderów.')).toBeNull()
  client.clear()
})
