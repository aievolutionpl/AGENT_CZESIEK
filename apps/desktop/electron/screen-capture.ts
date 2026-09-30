// One screenshot of the primary display, on request of the voice agent: no stream, no file, nothing kept.
// The picture is downscaled here (a 1600 px JPEG is a few hundred KB) and only handed to the renderer that
// asked; the backend's vision model describes it. Electron stays injected so the rules are testable.
import { desktopCapturer, ipcMain, screen, systemPreferences } from 'electron'

import { assertTrustedRendererSender } from './renderer-document-trust'

export const MAX_EDGE = 1600
export const JPEG_QUALITY = 70

export type ScreenShot =
  | { dataUrl: string; height: number; ok: true; width: number }
  | { error: 'denied' | 'empty' | 'unavailable'; ok: false }

interface Size {
  height: number
  width: number
}

interface CapturedImage {
  getSize: () => Size
  isEmpty: () => boolean
  toJPEG: (quality: number) => Buffer
}

interface CaptureSource {
  display_id: string
  thumbnail: CapturedImage
}

export interface ScreenCaptureDeps {
  display: () => { id: number; size: Size }
  getSources: (options: { thumbnailSize: Size; types: ['screen'] }) => Promise<CaptureSource[]>
  platform: NodeJS.Platform
  /** macOS Screen Recording status: `granted`, `denied`, `restricted`, `not-determined`. */
  screenAccess: () => string
}

export function targetSize(size: Size, maxEdge = MAX_EDGE): Size {
  const scale = Math.min(1, maxEdge / Math.max(size.width, size.height, 1))

  return { height: Math.max(1, Math.round(size.height * scale)), width: Math.max(1, Math.round(size.width * scale)) }
}

/** The source of the wanted display; some platforms leave `display_id` empty, then the first one is it. */
export function pickSource(sources: readonly CaptureSource[], displayId: number) {
  return sources.find(source => source.display_id === String(displayId)) ?? sources[0]
}

export async function captureScreen({
  display,
  getSources,
  platform,
  screenAccess
}: ScreenCaptureDeps): Promise<ScreenShot> {
  // macOS hands back blank pictures without the Screen Recording permission: say so instead of describing nothing.
  if (platform === 'darwin' && ['denied', 'restricted'].includes(screenAccess())) {
    return { error: 'denied', ok: false }
  }

  const target = display()
  let sources: CaptureSource[]

  try {
    sources = await getSources({ thumbnailSize: targetSize(target.size), types: ['screen'] })
  } catch {
    return { error: 'unavailable', ok: false }
  }

  const source = pickSource(sources, target.id)

  if (!source) {
    return { error: 'unavailable', ok: false }
  }

  if (source.thumbnail.isEmpty()) {
    return { error: platform === 'darwin' ? 'denied' : 'empty', ok: false }
  }

  const { height, width } = source.thumbnail.getSize()

  return {
    dataUrl: `data:image/jpeg;base64,${source.thumbnail.toJPEG(JPEG_QUALITY).toString('base64')}`,
    height,
    ok: true,
    width
  }
}

export function registerScreenCaptureIpc({ rendererUrl }: { rendererUrl: string }) {
  ipcMain.handle('hermes:captureScreen', async event => {
    assertTrustedRendererSender(event, rendererUrl)

    return captureScreen({
      display: () => screen.getPrimaryDisplay(),
      getSources: options => desktopCapturer.getSources(options),
      platform: process.platform,
      screenAccess: () => systemPreferences.getMediaAccessStatus('screen')
    })
  })
}
