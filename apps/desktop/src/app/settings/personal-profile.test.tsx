import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

const mock = vi.hoisted(() => ({
  scope: { connectionId: 'remote-a', profile: 'office' },
  get: vi.fn(),
  save: vi.fn(),
  cache: vi.fn(),
  config: { custom_prompt: 'Keep existing project rules.', display: {} }
}))

vi.mock('@/hooks/use-active-capability-scope', () => ({
  useActiveCapabilityScope: () => ({ scope: mock.scope, scopeKey: 'remote-a:office' })
}))
vi.mock('@/hermes', () => ({ getHermesConfigRecord: mock.get, saveHermesConfigRecord: mock.save }))
vi.mock('../hooks/use-config-record', () => ({
  useHermesConfigRecord: () => ({ data: mock.config }),
  hermesConfigCacheWriter: () => mock.cache
}))
vi.mock('../jarvis/onboarding-personality', () => ({
  PersonalityStep: ({ onChange }: { onChange: (value: unknown) => void }) => (
    <button
      onClick={() => onChange({ name: 'Ada', purpose: 'Moja firma', tone: 'friendly', detail: 'brief' })}
      type="button"
    >
      Zmień profil
    </button>
  )
}))

import { PersonalProfileSettings } from './personal-profile'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

it('writes to the captured connection and profile while preserving current unrelated config', async () => {
  mock.get.mockResolvedValue({
    custom_prompt: 'Updated project rules.',
    display: { theme: 'light' },
    model: 'existing-model'
  })
  mock.save.mockResolvedValue({ ok: true })
  render(<PersonalProfileSettings />)
  fireEvent.click(screen.getByRole('button', { name: 'Zmień profil' }))
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz profil' }))
  })
  expect(mock.get).toHaveBeenCalledWith(mock.scope)
  expect(mock.save).toHaveBeenCalledWith(
    expect.objectContaining({
      model: 'existing-model',
      display: expect.objectContaining({ theme: 'light', czesiek_profile: expect.objectContaining({ name: 'Ada' }) }),
      custom_prompt: expect.stringContaining('Updated project rules.')
    }),
    mock.scope
  )
  expect(screen.getByRole('status').textContent).toContain('nowej rozmowie')
})

it('does not write a profile when the editor closes before the fresh read finishes', async () => {
  let resolveRead!: (value: unknown) => void
  mock.get.mockImplementation(
    () =>
      new Promise(resolve => {
        resolveRead = resolve
      })
  )
  const view = render(<PersonalProfileSettings />)
  fireEvent.click(screen.getByRole('button', { name: 'Zmień profil' }))
  fireEvent.click(screen.getByRole('button', { name: 'Zapisz profil' }))
  view.unmount()
  await act(async () => {
    resolveRead(mock.config)
  })
  expect(mock.save).not.toHaveBeenCalled()
})
