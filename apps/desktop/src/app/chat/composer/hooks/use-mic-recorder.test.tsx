import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { type MicRecorderErrorCopy, useMicRecorder } from './use-mic-recorder'

const copy: MicRecorderErrorCopy = {
  microphoneAccessDenied: 'access denied',
  microphoneConstraintsUnsupported: 'constraints unsupported',
  microphoneInUse: 'in use',
  microphonePermissionDenied: 'permission denied',
  microphoneStartFailed: 'start failed',
  microphoneUnsupported: 'unsupported',
  noMicrophone: 'no microphone'
}

afterEach(cleanup)

describe('useMicRecorder cancellation', () => {
  it('stops a stream that resolves after cancellation during permission acquisition', async () => {
    let resolveStream!: (stream: MediaStream) => void
    const track = { stop: vi.fn() }
    const stream = { getTracks: () => [track] } as unknown as MediaStream
    const getUserMedia = vi.fn(() => new Promise<MediaStream>(resolve => (resolveStream = resolve)))

    vi.stubGlobal(
      'MediaRecorder',
      class {
        static isTypeSupported() {
          return false
        }
      }
    )
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } })
    let resolvePermission!: (allowed: boolean) => void

    const requestMicrophoneAccess = vi.fn(() => new Promise<boolean>(resolve => (resolvePermission = resolve)))

    Object.defineProperty(window, 'hermesDesktop', {
      configurable: true,
      value: { requestMicrophoneAccess }
    })

    const { result } = renderHook(() => useMicRecorder(copy))
    let pending!: Promise<void>

    await act(async () => {
      pending = result.current.handle.start()
      result.current.handle.cancel()
      resolvePermission(true)
      await Promise.resolve()
      resolveStream(stream)
      await pending
    })

    expect(track.stop).toHaveBeenCalledTimes(1)
    expect(result.current.recording).toBe(false)
  })
})
