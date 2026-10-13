import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { I18nProvider } from '@/i18n'

import { GoogleConnectDialog } from './google-connect-dialog'

const owner = vi.hoisted(() => ({ connectionId: 'alpha', profile: 'default' }))
vi.mock('@/hooks/use-active-capability-scope', () => ({
  useActiveCapabilityScope: () => ({ scope: { ...owner }, scopeKey: `${owner.connectionId}::${owner.profile}` })
}))
vi.mock('@/store/notifications', () => ({ notifyError: vi.fn() }))
beforeEach(() => vi.stubGlobal('hermesDesktop', { api: vi.fn() }))
afterEach(() => {
  cleanup()
  owner.connectionId = 'alpha'
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const view = () => (
  <MemoryRouter>
    <I18nProvider configClient={null} initialLocale="pl">
      <GoogleConnectDialog onClose={vi.fn()} open />
    </I18nProvider>
  </MemoryRouter>
)
const status = { client_secret: false, connected: false, token: false, services: [], can_send_mail: false }

describe('Google setup', () => {
  it('does not tell the user to configure again when status could not be loaded', async () => {
    vi.spyOn(window.hermesDesktop, 'api').mockRejectedValueOnce(new Error('offline')).mockResolvedValue(status)
    render(view())
    expect(screen.queryByRole('button', { name: 'Wybierz plik JSON' })).toBeNull()
    fireEvent.click(await screen.findByRole('button', { name: 'Spróbuj ponownie' }))
    expect(await screen.findByRole('button', { name: 'Wybierz plik JSON' })).toBeTruthy()
  })

  it('pins a delayed uploaded file to the connection that requested it', async () => {
    let finishRead!: (text: string) => void
    const api = vi.spyOn(window.hermesDesktop, 'api').mockResolvedValue(status)
    const mounted = render(view())
    await screen.findByRole('button', { name: 'Wybierz plik JSON' })
    const input = mounted.container.ownerDocument.querySelector('input[type="file"]')!
    fireEvent.change(input, {
      target: {
        files: [
          {
            text: () =>
              new Promise<string>(resolve => {
                finishRead = resolve
              })
          }
        ]
      }
    })
    owner.connectionId = 'beta'
    mounted.rerender(view())
    await act(async () => finishRead('{"installed":{"client_id":"test"}}'))
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith(
        expect.objectContaining({ path: '/api/google/client-secret', connectionId: 'alpha', profile: 'default' })
      )
    )
    expect(api.mock.calls.filter(([request]) => request.path === '/api/google/client-secret')).toHaveLength(1)
  })
})
