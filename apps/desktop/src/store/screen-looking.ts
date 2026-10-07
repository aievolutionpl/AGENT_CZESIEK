import { atom } from 'nanostores'

/** Long enough to notice: a capture takes a fraction of a second, a privacy cue must outlast it. */
export const LOOKING_MIN_MS = 1500

/** True while Czesiek is taking a look at the screen, so the voice screen can say so. */
export const $screenLooking = atom(false)

/**
 * Runs `look` with the "looking" cue on, and keeps the cue up for at least `LOOKING_MIN_MS`
 * from the start, whatever the capture result (or failure) was.
 */
export async function whileLooking<T>(look: () => Promise<T>, minMs = LOOKING_MIN_MS): Promise<T> {
  const started = Date.now()

  $screenLooking.set(true)

  try {
    return await look()
  } finally {
    const rest = Math.max(0, minMs - (Date.now() - started))

    window.setTimeout(() => $screenLooking.set(false), rest)
  }
}
