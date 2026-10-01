import { afterEach, describe, expect, it, vi } from 'vitest'

import type { DeskDigest, DeskItem, DeskVerdict } from '@/api/voice-desk'

import { type DeskKnown, diffDesk, startDeskWatcher } from './desk-watcher'

const item = (id: string, verdict: DeskVerdict, over: Partial<DeskItem> = {}): DeskItem => ({
  age_s: 0,
  assignee: 'default',
  attention: false,
  created_by: 'voice',
  id,
  line: `- ${id}: ${verdict}`,
  reason: '',
  session_id: 's1',
  status: verdict,
  summary: '',
  title: id,
  verdict,
  ...over
})

describe('diffDesk', () => {
  it('treats the first read as the baseline: work that was already finished is not news', () => {
    const known: DeskKnown = new Map()

    expect(diffDesk(known, [item('a', 'done'), item('b', 'running')], 's1', true)).toEqual([])
    expect(diffDesk(known, [item('a', 'done'), item('b', 'running')], 's1')).toEqual([])
    expect(diffDesk(known, [item('a', 'done'), item('b', 'done')], 's1')).toEqual(['- b: done'])
  })

  it('says each change once, and only for outcomes worth interrupting for', () => {
    const known: DeskKnown = new Map()

    diffDesk(known, [item('a', 'queued')], 's1', true)

    expect(diffDesk(known, [item('a', 'running')], 's1')).toEqual([])
    expect(diffDesk(known, [item('a', 'retrying')], 's1')).toEqual([])
    expect(diffDesk(known, [item('a', 'needs_you')], 's1')).toEqual(['- a: needs_you'])
    expect(diffDesk(known, [item('a', 'needs_you')], 's1')).toEqual([])
    expect(diffDesk(known, [item('a', 'done_unreported')], 's1')).toEqual(['- a: done_unreported'])
  })

  it("announces a task that appears already finished, but only when it is this conversation's", () => {
    const known: DeskKnown = new Map()

    diffDesk(known, [], 's1', true)

    const fresh = [
      item('mine-voice', 'done', { session_id: null }),
      item('mine-chat', 'done', { created_by: 'default', session_id: 's1' }),
      item('theirs', 'done', { created_by: 'cron', session_id: 's2' })
    ]

    expect(diffDesk(known, fresh, 's1')).toEqual(['- mine-voice: done', '- mine-chat: done'])
  })
})

describe('startDeskWatcher', () => {
  afterEach(() => vi.useRealTimers())

  const digest = (...items: DeskItem[]) => ({ items }) as DeskDigest

  it('seeds on the first read, pushes later changes, survives a failed read and stops when told', async () => {
    vi.useFakeTimers()

    const reads = [digest(item('a', 'running')), new Error('busy'), digest(item('a', 'done'))]

    const fetchDesk = vi.fn(async () => {
      const next = reads.shift()

      if (next instanceof Error) {
        throw next
      }

      return next ?? digest(item('a', 'done'))
    })

    const push = vi.fn()

    const stop = startDeskWatcher({ fetchDesk, intervalMs: 1000, lang: () => 'pl', push, sessionId: () => 's1' })

    await vi.advanceTimersByTimeAsync(0)
    expect(push).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1000)
    expect(push).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1000)
    expect(push).toHaveBeenCalledExactlyOnceWith('- a: done')

    stop()
    fetchDesk.mockClear()
    await vi.advanceTimersByTimeAsync(5000)
    expect(fetchDesk).not.toHaveBeenCalled()
  })
})
