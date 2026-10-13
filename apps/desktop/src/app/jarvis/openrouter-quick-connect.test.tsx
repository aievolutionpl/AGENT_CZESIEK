import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { I18nProvider } from '@/i18n'
import type { ModelOptionsResponse } from '@/types/hermes'

import { OPENROUTER_CONNECT_TIMEOUT_MS, type OpenRouterConnectDeps } from './openrouter-connect'
import { OpenRouterQuickConnect } from './openrouter-quick-connect'

// Mock-only provider tests. No network requests or live credentials.
const options = {
  providers: [{ slug: 'openrouter', authenticated: true, name: 'OpenRouter', models: ['deepseek/deepseek-v4.1-flash'] }]
} as ModelOptionsResponse

function deps(): OpenRouterConnectDeps {
  return {
    validate: vi.fn(async () => ({ ok: true, reachable: true })),
    saveKey: vi.fn(async () => ({ ok: true })),
    loadOptions: vi.fn(async () => options)
  }
}

function mount(dependencies: OpenRouterConnectDeps, onConnected = vi.fn()) {
  return {
    onConnected,
    ...render(
      <I18nProvider configClient={null} initialLocale="en">
        <OpenRouterQuickConnect deps={dependencies} onConnected={onConnected} />
      </I18nProvider>
    )
  }
}

function submit() {
  fireEvent.change(screen.getByLabelText('OpenRouter API key'), { target: { value: 'mock-only-key' } })
  fireEvent.submit(screen.getByTestId('openrouter-quick-connect'))
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})
describe('mock-only quick connect recovery', () => {
  it('releases a hung save, preserves the key for retry, and never reports its late result', async () => {
    vi.useFakeTimers()
    const dependencies = deps()
    let resolve!: (value: { ok: boolean }) => void
    dependencies.saveKey = vi.fn(
      () =>
        new Promise(done => {
          resolve = done
        })
    )
    const { onConnected } = mount(dependencies)
    submit()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(OPENROUTER_CONNECT_TIMEOUT_MS + 10)
    })
    expect(screen.getByRole('alert').textContent).toContain('may have been saved')
    expect(screen.getByRole('button', { name: 'Connect' }).hasAttribute('disabled')).toBe(false)
    expect((screen.getByLabelText('OpenRouter API key') as HTMLInputElement).value).toBe('mock-only-key')
    dependencies.saveKey = vi.fn(async () => ({ ok: true }))
    fireEvent.submit(screen.getByTestId('openrouter-quick-connect'))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(onConnected).toHaveBeenCalledOnce()
    await act(async () => resolve({ ok: true }))
    expect(onConnected).toHaveBeenCalledOnce()
  })
  it('does not save or notify after unmounting a pending validation', async () => {
    const dependencies = deps()
    let resolve!: (value: { ok: boolean; reachable: boolean }) => void
    dependencies.validate = vi.fn(
      () =>
        new Promise<{ ok: boolean; reachable: boolean }>(done => {
          resolve = done
        })
    )
    const { unmount, onConnected } = mount(dependencies)
    submit()
    await waitFor(() => expect(dependencies.validate).toHaveBeenCalledOnce())
    unmount()
    await act(async () => resolve({ ok: true, reachable: true }))
    expect(dependencies.saveKey).not.toHaveBeenCalled()
    expect(onConnected).not.toHaveBeenCalled()
  })
})
