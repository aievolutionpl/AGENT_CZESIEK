import { describe, expect, it, vi } from 'vitest'

// The shell module pulls in Electron for its IPC registration only; the capture rules are pure.
vi.mock('electron', () => ({ desktopCapturer: {}, ipcMain: { handle: vi.fn() }, screen: {}, systemPreferences: {} }))

import { captureScreen, MAX_EDGE, pickSource, type ScreenCaptureDeps, targetSize } from './screen-capture'

const image = (empty = false, size = { height: 900, width: 1440 }) => ({
  getSize: () => size,
  isEmpty: () => empty,
  toJPEG: () => Buffer.from('jpeg-bytes')
})

const deps = (over: Partial<ScreenCaptureDeps> = {}): ScreenCaptureDeps => ({
  display: () => ({ id: 2, size: { height: 2160, width: 3840 } }),
  getSources: async () => [
    { display_id: '1', thumbnail: image(true) },
    { display_id: '2', thumbnail: image() }
  ],
  platform: 'linux',
  screenAccess: () => 'granted',
  ...over
})

describe('screen capture', () => {
  it('never asks for a picture bigger than the cap, and never upscales a small screen', () => {
    const big = targetSize({ height: 2160, width: 3840 })

    expect(Math.max(big.width, big.height)).toBe(MAX_EDGE)
    expect(big.width / big.height).toBeCloseTo(3840 / 2160, 1)
    expect(targetSize({ height: 600, width: 800 })).toEqual({ height: 600, width: 800 })
  })

  it('takes the wanted display, else the first source', () => {
    const sources = [
      { display_id: '1', thumbnail: image() },
      { display_id: '2', thumbnail: image() }
    ]

    expect(pickSource(sources, 2)).toBe(sources[1])
    expect(pickSource([{ display_id: '', thumbnail: image() }], 7)).toBeDefined()
    expect(pickSource([], 1)).toBeUndefined()
  })

  it('returns a JPEG data URL of the primary display', async () => {
    const shot = await captureScreen(deps())

    expect(shot).toMatchObject({ height: 900, ok: true, width: 1440 })
    expect(shot.ok && shot.dataUrl).toBe(`data:image/jpeg;base64,${Buffer.from('jpeg-bytes').toString('base64')}`)
  })

  it('says denied on macOS without permission instead of returning a blank picture', async () => {
    const getSources = vi.fn()

    expect(await captureScreen(deps({ getSources, platform: 'darwin', screenAccess: () => 'denied' }))).toEqual({
      error: 'denied',
      ok: false
    })
    expect(getSources).not.toHaveBeenCalled()

    const blank = deps({ getSources: async () => [{ display_id: '2', thumbnail: image(true) }], platform: 'darwin' })

    expect(await captureScreen(blank)).toEqual({ error: 'denied', ok: false })
  })

  it('reports a failing or empty capture as unavailable, not as a crash', async () => {
    expect(await captureScreen(deps({ getSources: async () => Promise.reject(new Error('portal')) }))).toEqual({
      error: 'unavailable',
      ok: false
    })
    expect(await captureScreen(deps({ getSources: async () => [] }))).toEqual({ error: 'unavailable', ok: false })
  })
})
