/**
 * Reports of finished work, pushed to the voice agent without anyone asking.
 *
 * The board is the ledger: every few seconds the watcher reads the digest and, for a task this
 * conversation started (by voice, or in this chat), turns a change into something worth saying — done,
 * closed without a report, waiting for the user, blocked, or gone quiet. The first read only sets the
 * baseline, so work that was already finished when the call began is never announced as news.
 */

import type { DeskDigest, DeskItem, DeskLang, DeskVerdict } from '@/api/voice-desk'

/** Verdicts that are worth interrupting for; `running`, `queued` and `retrying` are not. */
const ANNOUNCED: ReadonlySet<DeskVerdict> = new Set(['blocked', 'done', 'done_unreported', 'needs_you', 'stalled'])

export const DESK_POLL_MS = 8_000

/** Verdicts seen so far, by task id. */
export type DeskKnown = Map<string, DeskVerdict>

const isMine = (item: DeskItem, sessionId: null | string) =>
  item.created_by === 'voice' || (sessionId !== null && item.session_id === sessionId)

/**
 * The announcements for what changed since `known`, which is updated in place. With `seed` nothing is
 * announced: the digest only becomes the baseline.
 */
export function diffDesk(known: DeskKnown, items: readonly DeskItem[], sessionId: null | string, seed = false) {
  const announcements: string[] = []

  for (const item of items) {
    const before = known.get(item.id)

    known.set(item.id, item.verdict)

    if (!seed && before !== item.verdict && ANNOUNCED.has(item.verdict) && isMine(item, sessionId)) {
      announcements.push(item.line)
    }
  }

  return announcements
}

export interface DeskWatcherDeps {
  fetchDesk: (lang: DeskLang) => Promise<DeskDigest>
  intervalMs?: number
  lang: () => DeskLang
  push: (text: string) => void
  sessionId: () => null | string
}

/** Start polling the board; returns the stop function. A board that cannot be read is skipped, never fatal. */
export function startDeskWatcher({ fetchDesk, intervalMs = DESK_POLL_MS, lang, push, sessionId }: DeskWatcherDeps) {
  const known: DeskKnown = new Map()
  let seeded = false
  let stopped = false
  let inFlight = false

  const poll = async () => {
    if (stopped || inFlight) {
      return
    }

    inFlight = true

    try {
      const digest = await fetchDesk(lang())

      if (!stopped) {
        for (const text of diffDesk(known, digest.items, sessionId(), !seeded)) {
          push(text)
        }

        seeded = true
      }
    } catch {
      // Board unavailable this round (older backend, busy database): try again next tick.
    } finally {
      inFlight = false
    }
  }

  void poll()

  const timer = window.setInterval(() => void poll(), intervalMs)

  return () => {
    stopped = true
    window.clearInterval(timer)
  }
}
