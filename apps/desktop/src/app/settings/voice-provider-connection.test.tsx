import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { VoiceProviderChoice } from './voice-provider-choice'
import { VoiceProviderConnection } from './voice-provider-connection'

const mocks = vi.hoisted(() => ({ saveValue: vi.fn(), vars: {} as Record<string, { is_set: boolean }> }))
vi.mock('@/i18n', () => ({ useI18n: () => ({ locale: 'pl' }) }))
vi.mock('./env-credentials', () => ({ useEnvCredentials: () => ({ vars: mocks.vars, saveValue: mocks.saveValue }) }))

function mount(provider: VoiceProviderChoice = 'gemini') {
  const change = vi.fn()
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <VoiceProviderConnection
          onChange={change}
          provider={provider}
          scope={{ connectionId: null, profile: 'alpha' }}
        />
      </MemoryRouter>
    </QueryClientProvider>
  )

  return change
}

describe('voice provider connection', () => {
  beforeEach(() => {
    mocks.vars = {}
    mocks.saveValue.mockReset().mockResolvedValue({ ok: true })
  })

  it('offers all three providers and explains the subscription boundary', () => {
    const change = mount('openai')
    fireEvent.click(screen.getByRole('button', { name: /ElevenLabs/ }))
    expect(change).toHaveBeenCalledWith('elevenlabs')
    expect(screen.getByText(/Subskrypcja ChatGPT i OpenAI API to oddzielne usługi/)).toBeTruthy()
  })

  it('saves the dedicated voice key and clears it from the form after success', async () => {
    mount('openai')
    const input = screen.getByLabelText('Klucz API dostawcy głosu') as HTMLInputElement
    expect(input.type).toBe('password')
    fireEvent.change(input, { target: { value: '  test-key  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz klucz' }))
    await waitFor(() => expect(mocks.saveValue).toHaveBeenCalledWith('VOICE_TOOLS_OPENAI_KEY', 'test-key'))
    await waitFor(() => expect(input.value).toBe(''))
  })

  it('keeps a failed save visible and does not announce a working connection', async () => {
    mocks.saveValue.mockResolvedValue({ ok: false, message: 'Brak połączenia z silnikiem' })
    mount('elevenlabs')
    fireEvent.change(screen.getByLabelText('Klucz API dostawcy głosu'), { target: { value: 'test-key' } })
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz klucz' }))
    expect(await screen.findByText('Brak połączenia z silnikiem')).toBeTruthy()
    expect(screen.queryByText(/Klucz zapisany. Wybierz głos/)).toBeNull()
  })

  it('recognizes an existing Google key without revealing its value', () => {
    mocks.vars = { GOOGLE_API_KEY: { is_set: true } }
    mount()
    expect(screen.getByText(/Klucz zapisany w tym profilu/)).toBeTruthy()
  })

  it('opens the trusted provider console through desktop IPC, without a popup', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(window, 'hermesDesktop')
    const openExternal = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(window, 'hermesDesktop', { configurable: true, value: { openExternal } })

    try {
      mount('elevenlabs')
      fireEvent.click(screen.getByRole('button', { name: 'Uzyskaj klucz u dostawcy' }))
      expect(openExternal).toHaveBeenCalledWith('https://elevenlabs.io/app/settings/api-keys')
    } finally {
      if (descriptor) {
        Object.defineProperty(window, 'hermesDesktop', descriptor)
      } else {
        Reflect.deleteProperty(window, 'hermesDesktop')
      }
    }
  })
})
