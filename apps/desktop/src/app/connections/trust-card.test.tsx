import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { I18nProvider } from '@/i18n'

import { TrustCard } from './trust-card'

const owner = vi.hoisted(() => ({ connectionId: 'alpha', profile: 'default' }))
vi.mock('@/hooks/use-active-capability-scope', () => ({
  useActiveCapabilityScope: () => ({ scope: { ...owner }, scopeKey: `${owner.connectionId}::${owner.profile}` })
}))

beforeEach(() => {
  vi.stubGlobal('hermesDesktop', { api: vi.fn() })
})
afterEach(() => {
  cleanup()
  owner.connectionId = 'alpha'
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function view(client: QueryClient) {
  return (
    <QueryClientProvider client={client}>
      <I18nProvider configClient={null} initialLocale="pl">
        <TrustCard />
      </I18nProvider>
    </QueryClientProvider>
  )
}

describe('integration permissions', () => {
  it('keeps a late permission write on its original connection, including the same profile name', async () => {
    let finish!: (value: unknown) => void

    const api = vi.spyOn(window.hermesDesktop, 'api').mockImplementation(async request => {
      if (request.method === 'POST') {
        return new Promise(resolve => {
          finish = resolve
        })
      }

      return { levels: { google: request.connectionId === 'alpha' ? 'ask' : 'read' }, log: [] }
    })

    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
    const mounted = render(view(client))
    await waitFor(() =>
      expect(screen.getByRole('radio', { name: 'Działa po zgodzie' }).getAttribute('aria-checked')).toBe('true')
    )
    fireEvent.click(screen.getByRole('radio', { name: 'Działa sam' }))
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith(
        expect.objectContaining({ connectionId: 'alpha', profile: 'default', method: 'POST' })
      )
    )
    owner.connectionId = 'beta'
    mounted.rerender(view(client))
    await waitFor(() =>
      expect(screen.getByRole('radio', { name: 'Tylko czyta' }).getAttribute('aria-checked')).toBe('true')
    )
    await act(async () => finish({ levels: { google: 'auto' }, log: [] }))
    expect(screen.getByRole('radio', { name: 'Tylko czyta' }).getAttribute('aria-checked')).toBe('true')
    client.clear()
  })

  it('offers retry after a failed permission read and never offers writes without the current permissions', async () => {
    const api = vi
      .spyOn(window.hermesDesktop, 'api')
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({ levels: { google: 'ask' }, log: [] })

    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
    render(view(client))
    fireEvent.click(await screen.findByRole('button', { name: 'Spróbuj ponownie' }))
    await screen.findByRole('radio', { name: 'Działa po zgodzie' })
    expect(api).toHaveBeenCalledTimes(2)
    client.clear()
  })
})
