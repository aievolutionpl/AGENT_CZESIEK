import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { getGoogleStatus, verifyGoogle } from '@/api/google'
import { I18nProvider } from '@/i18n'

import { GoogleServiceStatus } from './google-service-status'

const owner = vi.hoisted(() => ({ profile: 'default' }))
vi.mock('@/hooks/use-active-capability-scope', () => ({
  useActiveCapabilityScope: () => ({
    scope: { connectionId: 'local', profile: owner.profile },
    scopeKey: owner.profile
  })
}))
vi.mock('@/api/google', () => ({ getGoogleStatus: vi.fn(), verifyGoogle: vi.fn() }))

afterEach(() => {
  cleanup()
  vi.resetAllMocks()
  owner.profile = 'default'
})

function harness() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  const ui = () => (
    <QueryClientProvider client={client}>
      <I18nProvider configClient={null} initialLocale="pl">
        <GoogleServiceStatus onReconnect={vi.fn()} />
      </I18nProvider>
    </QueryClientProvider>
  )

  return { ...render(ui()), ui }
}

describe('Google service status', () => {
  it('requires a probe and reports each service independently', async () => {
    vi.mocked(getGoogleStatus).mockResolvedValue({
      token: true,
      client_secret: true,
      can_send_mail: false,
      connected: false,
      services: ['gmail.readonly', 'calendar.readonly', 'drive.readonly']
    })
    vi.mocked(verifyGoogle).mockResolvedValue({
      ok: false,
      services: { gmail: { state: 'connected' }, calendar: { state: 'permission' }, drive: { state: 'reauthorize' } }
    })
    harness()
    await screen.findAllByText('Zapisano dane — wykonaj test połączenia.')
    expect(screen.queryByText('Połączenie potwierdzone')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Przetestuj' }))
    await screen.findByText('Połączenie potwierdzone')
    expect(screen.getByText('Brak uprawnień lub wyłączone API')).toBeTruthy()
    expect(screen.getByText('Zaloguj się ponownie')).toBeTruthy()
    expect(verifyGoogle).toHaveBeenCalledWith({ connectionId: 'local', profile: 'default' })
  })

  it('does not show a previous profile probe in the new profile', async () => {
    vi.mocked(getGoogleStatus).mockResolvedValue({
      token: true,
      client_secret: true,
      can_send_mail: false,
      connected: false,
      services: []
    })
    let resolve!: (value: Awaited<ReturnType<typeof verifyGoogle>>) => void
    vi.mocked(verifyGoogle).mockImplementation(
      () =>
        new Promise(res => {
          resolve = res
        })
    )
    const view = harness()
    await waitFor(() =>
      expect((screen.getByRole('button', { name: 'Przetestuj' }) as HTMLButtonElement).disabled).toBe(false)
    )
    fireEvent.click(screen.getByRole('button', { name: 'Przetestuj' }))
    owner.profile = 'work'
    view.rerender(view.ui())
    await act(async () => resolve({ ok: true, gmail_ok: true, calendar_ok: true, drive_ok: true }))
    expect(
      within(screen.getByRole('region', { name: 'Usługi Google' })).queryByText('Połączenie potwierdzone')
    ).toBeNull()
    expect(getGoogleStatus).toHaveBeenLastCalledWith({ connectionId: 'local', profile: 'work' })
  })
})
