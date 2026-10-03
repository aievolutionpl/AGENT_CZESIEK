import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

import { I18nProvider } from '@/i18n'

import { UninstallSection } from './uninstall-section'

const originalBridge = window.hermesDesktop

afterEach(() => {
  cleanup()
  window.hermesDesktop = originalBridge
})

function showUninstall() {
  const run = vi.fn().mockResolvedValue({ ok: false })
  window.hermesDesktop = {
    ...originalBridge,
    uninstall: {
      summary: vi.fn().mockResolvedValue({ agent_installed: true }),
      run
    }
  } as unknown as Window['hermesDesktop']
  render(
    <I18nProvider configClient={null} initialLocale="pl">
      <UninstallSection />
    </I18nProvider>
  )

  return run
}

it('keeps data-preserving uninstall behind a Polish confirmation and sends the selected mode', async () => {
  const run = showUninstall()
  fireEvent.click(await screen.findByRole('button', { name: /Usuń aplikację i silnik, zachowaj moje dane/ }))
  expect(run).not.toHaveBeenCalled()
  expect(screen.getByText(/ustawienia, rozmowy i klucze API pozostaną/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Anuluj' }))
  expect(run).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: /Usuń aplikację i silnik, zachowaj moje dane/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Tak, odinstaluj' }))
  expect(run).toHaveBeenCalledWith('lite')
  expect((await screen.findByRole('alert')).textContent).toContain('Nie udało się rozpocząć odinstalowania.')
})
