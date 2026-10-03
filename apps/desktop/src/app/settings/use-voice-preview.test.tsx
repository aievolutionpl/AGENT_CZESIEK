import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useVoicePreview, type VoiceSample } from './use-voice-preview'

vi.mock('@/store/notifications', () => ({ notifyError: vi.fn() }))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function player() {
  const play = vi.fn(async () => {})
  const pause = vi.fn()
  const create = vi.fn(() => 'blob:sample')

  class FakeAudio {
    play = play
    pause = pause
    onended = null
  }
  vi.stubGlobal('Audio', FakeAudio)
  vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: vi.fn() })

  return { create, pause, play }
}

const sample = { audio: 'YQ==', mime: 'audio/wav' }

describe('voice preview lifetime', () => {
  it('only plays the latest sample when responses arrive out of order', async () => {
    const audio = player()
    let resolve!: (sample: VoiceSample) => void

    const slow = new Promise<VoiceSample>(done => {
      resolve = done
    })

    const { result } = renderHook(() => useVoicePreview('local:a', 'failed'))
    let first!: Promise<void>
    act(() => {
      first = result.current.play('first', () => slow)
    })
    await act(async () => {
      await result.current.play('second', async () => sample)
    })
    await act(async () => {
      resolve(sample)
      await first
    })
    expect(audio.play).toHaveBeenCalledTimes(1)
    expect(audio.create).toHaveBeenCalledTimes(1)
    expect(result.current.playing).toBe('second')
  })

  it('invalidates pending playback across profile changes and unmount', async () => {
    const audio = player()
    let resolve!: (sample: VoiceSample) => void

    const slow = new Promise<VoiceSample>(done => {
      resolve = done
    })

    const { result, rerender, unmount } = renderHook(({ owner }) => useVoicePreview(owner, 'failed'), {
      initialProps: { owner: 'local:a' }
    })

    let pending!: Promise<void>
    act(() => {
      pending = result.current.play('first', () => slow)
    })
    rerender({ owner: 'remote:b' })
    unmount()
    await act(async () => {
      resolve(sample)
      await pending
    })
    expect(audio.play).not.toHaveBeenCalled()
    expect(audio.create).not.toHaveBeenCalled()
  })
})
