/**
 * Reports of finished work, pushed to the voice agent without anyone asking.
 *
 * The board is the ledger: every few seconds the watcher reads the digest and, for a task this
 * conversation started (by voice, or in this chat), turns a change into something worth saying — done,
 * closed without a report, waiting for the user, blocked, or gone quiet. The first read only sets the
 * baseline, so work that was already finished when the call began is never announced as news.
 */

import type { DeskDigest, DeskItem, DeskLang, DeskVerdict } from '@/api/voice-desk'

/** Important transitions; unchanged active work gets a separate, throttled update. */
const ANNOUNCED: ReadonlySet<DeskVerdict> = new Set([
  'blocked',
  'done',
  'done_unreported',
  'needs_you',
  'stalled',
  'running',
  'retrying'
])

export const DESK_POLL_MS = 4_000
export const DESK_PROGRESS_MS = 20_000

/** Verdicts seen so far, by task id. */
export type DeskKnown = Map<string, DeskVerdict>

const isMine = (item: DeskItem, sessionId: null | string) =>
  (item.created_by === 'voice' && item.session_id === null) || (sessionId !== null && item.session_id === sessionId)

/**
 * The announcements for what changed since `known`, which is updated in place. With `seed` nothing is
 * announced: the digest only becomes the baseline.
 */
export function diffDesk(
  known: DeskKnown,
  items: readonly DeskItem[],
  sessionId: null | string,
  seed = false,
  assigned: ReadonlySet<string> = new Set()
) {
  const announcements: string[] = []

  for (const item of items) {
    const before = known.get(item.id)

    known.set(item.id, item.verdict)

    if (
      (!seed || assigned.has(item.id)) &&
      (before !== item.verdict || assigned.has(item.id)) &&
      ANNOUNCED.has(item.verdict) &&
      isMine(item, sessionId)
    ) {
      announcements.push(item.line)
    }
  }

  return announcements
}

export interface DeskWatcherDeps {
  assigned?: () => ReadonlySet<string>
  fetchDesk: (lang: DeskLang) => Promise<DeskDigest>
  intervalMs?: number
  lang: () => DeskLang
  push: (text: string, progress?: boolean) => void
  sessionId: () => null | string
}

/** Start polling the board; returns the stop function. A board that cannot be read is skipped, never fatal. */
export function startDeskWatcher({
  assigned,
  fetchDesk,
  intervalMs = DESK_POLL_MS,
  lang,
  push,
  sessionId
}: DeskWatcherDeps) {
  const known: DeskKnown = new Map()
  const seenAssignments = new Set<string>()
  let seeded = false
  let stopped = false
  let inFlight = false
  let lastProgress = Date.now()
  let owner = sessionId()

  const poll = async () => {
    if (stopped || inFlight) {
      return
    }

    inFlight = true
    const requestedSession = sessionId()

    try {
      const digest = await fetchDesk(lang())

      if (!stopped && requestedSession === sessionId()) {
        if (owner !== requestedSession) {
          known.clear()
          seenAssignments.clear()
          seeded = false
          owner = requestedSession
          lastProgress = Date.now()
        }

        const freshAssignments = new Set([...(assigned?.() || [])].filter(id => !seenAssignments.has(id)))
        const changes = diffDesk(known, digest.items, requestedSession, !seeded, freshAssignments)

        for (const item of digest.items) {
          if (freshAssignments.has(item.id)) {
            seenAssignments.add(item.id)
          }
        }

        for (const text of changes) {
          push(text)
        }

        if (changes.length) {
          lastProgress = Date.now()
        }

        const active = digest.items.filter(
          item =>
            isMine(item, requestedSession) && ['queued', 'running', 'retrying', 'in_review'].includes(item.verdict)
        )

        if (!changes.length && active.length && Date.now() - lastProgress >= DESK_PROGRESS_MS) {
          push(active.map(item => item.line).join('\n'), true)
          lastProgress = Date.now()
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
