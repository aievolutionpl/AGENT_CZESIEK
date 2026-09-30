// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { I18nProvider } from '@/i18n'
import { $speakerMuted } from '@/store/voice-output'

import { VoiceControls } from './voice-controls'

function renderControls(overrides: Partial<React.ComponentProps<typeof VoiceControls>> = {}) {
  const props = {
    listening: false,
    speaking: false,
    startListening: vi.fn(),
    stopListening: vi.fn(),
    stopPlayback: vi.fn(),
    ...overrides
  }

  render(
    <I18nProvider initialLocale="pl">
      <VoiceControls {...props} />
    </I18nProvider>
  )

  return props
}

afterEach(() => {
  cleanup()
  $speakerMuted.set(false)
})

describe('VoiceControls', () => {
  it('is only two buttons: the voice, and the conversation', () => {
    renderControls()

    expect(screen.getAllByRole('button')).toHaveLength(2)
  })

  it('starts the conversation when idle and ends it when live', () => {
    const idle = renderControls()

    fireEvent.click(screen.getByRole('button', { name: 'Zacznij rozmowę' }))
    expect(idle.startListening).toHaveBeenCalledTimes(1)
    cleanup()

    const live = renderControls({ listening: true })

    fireEvent.click(screen.getByRole('button', { name: 'Zakończ rozmowę' }))
    expect(live.stopListening).toHaveBeenCalledTimes(1)
    expect(live.startListening).not.toHaveBeenCalled()
  })

  it('mutes and restores the voice, cutting off speech that is playing when muting', () => {
    const controls = renderControls({ speaking: true })

    fireEvent.click(screen.getByRole('button', { name: 'Wycisz głos' }))
    expect($speakerMuted.get()).toBe(true)
    expect(controls.stopPlayback).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Włącz głos' }))
    expect($speakerMuted.get()).toBe(false)
    expect(controls.stopPlayback).toHaveBeenCalledTimes(1)
  })

  it('does nothing while disabled', () => {
    const controls = renderControls({ disabled: true })

    fireEvent.click(screen.getByRole('button', { name: 'Zacznij rozmowę' }))
    expect(controls.startListening).not.toHaveBeenCalled()
  })
})
