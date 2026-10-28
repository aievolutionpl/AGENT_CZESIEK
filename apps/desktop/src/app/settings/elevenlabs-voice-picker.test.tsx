import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, expect, it, vi } from 'vitest'

import { getElevenLabsVoices } from '@/api/system'
import { I18nProvider } from '@/i18n'

import { ElevenLabsVoicePicker } from './elevenlabs-voice-picker'

vi.mock('@/api/system', () => ({ getElevenLabsVoices: vi.fn() }))
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})

const scope = { connectionId: 'local', profile: 'work' }

function mount(onChange = vi.fn()) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <I18nProvider configClient={null} initialLocale="pl">
          <ElevenLabsVoicePicker chosen="account-voice" onChange={onChange} scope={scope} />
        </I18nProvider>
      </MemoryRouter>
    </QueryClientProvider>
  )

  return onChange
}

it('uses the account catalog and selects its stable voice identifier', async () => {
  vi.mocked(getElevenLabsVoices).mockResolvedValue({
    available: true,
    voices: [{ voice_id: 'account-voice', name: 'Mój głos', label: 'Mój głos' }]
  })
  const choose = mount()
  const voice = await screen.findByRole('button', { name: 'Mój głos' })
  expect(voice.getAttribute('aria-pressed')).toBe('true')
  fireEvent.click(voice)
  expect(choose).toHaveBeenCalledWith('account-voice')
  expect(getElevenLabsVoices).toHaveBeenCalledWith(scope)
})

it('explains rejected credentials without inventing voices or changing provider', async () => {
  vi.mocked(getElevenLabsVoices).mockResolvedValue({ available: false, voices: [], error: 'unauthorized' })
  const choose = mount()
  await screen.findByText('Klucz ElevenLabs został odrzucony. Sprawdź klucz i jego uprawnienia.')
  expect(screen.queryByRole('list')).toBeNull()
  expect(choose).not.toHaveBeenCalled()
})
