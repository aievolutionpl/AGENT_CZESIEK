import { whileLooking } from '@/store/screen-looking'

/** One look at the user's screen, taken by the desktop shell on request; never a stream, never stored. */

/** True in the desktop app, where the shell can capture; a browser tab cannot, so the voice never asks. */
export const canCaptureScreen = () => typeof window.hermesDesktop?.captureScreen === 'function'

/** The screenshot as a data URL, or null when capture is unavailable or the system denied it. */
export async function captureScreenDataUrl(): Promise<null | string> {
  try {
    const shot = await whileLooking(async () => window.hermesDesktop?.captureScreen?.())

    return shot && shot.ok ? shot.dataUrl : null
  } catch {
    return null
  }
}
