import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

import { FlowPanel } from '@/components/onboarding/flow'
import { I18nProvider } from '@/i18n'
import { makeOAuthProvider } from '@/test/oauth-provider'

import { ChatGptQuickConnect } from './chatgpt-quick-connect'

vi.mock('@/hermes', () => ({
  cancelOAuthSession: vi.fn(),
  getGlobalModelOptions: vi.fn(),
  pollOAuthSession: vi.fn(),
  setGlobalModel: vi.fn(),
  startOAuthLogin: vi.fn(async () => { throw new Error('Device login disabled') })
}))

afterEach(cleanup)

it('keeps device-login guidance available before sign-in and after rejection in both entry points', async () => {
  const onConnected = vi.fn()
  const loadOptions = vi.fn()

  const quick = render(
    <I18nProvider configClient={null} initialLocale="pl">
      <ChatGptQuickConnect loadOptions={loadOptions} onConnected={onConnected} />
    </I18nProvider>
  )

  expect(screen.getByTestId('chatgpt-login-guide').textContent).toContain('Bezpieczeństwo i logowanie')
  fireEvent.click(screen.getByRole('button', { name: 'Zaloguj się kontem ChatGPT' }))
  await waitFor(() => expect(screen.getByText('Device login disabled')).toBeTruthy())
  expect(screen.getByTestId('chatgpt-login-guide')).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Oficjalna instrukcja logowania' }).getAttribute('href')).toContain('developers.openai.com/codex/auth/')
  expect(onConnected).not.toHaveBeenCalled()
  expect(loadOptions).not.toHaveBeenCalled()
  quick.unmount()

  const provider = makeOAuthProvider('openai-codex')
  render(
    <I18nProvider configClient={null} initialLocale="pl">
      <FlowPanel ctx={{ requestGateway: vi.fn() }} flow={{ message: 'Device login disabled', provider, status: 'error' }} leaving={false} onBegin={vi.fn()} />
    </I18nProvider>
  )
  expect(screen.getByTestId('chatgpt-login-guide')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Wybierz innego dostawcę' })).toBeTruthy()
})
