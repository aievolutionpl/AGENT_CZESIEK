import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { type ReplyMessage, submitAndAwaitReply } from './agent-reply'

const msg = (id: string, extra: Partial<ReplyMessage> = {}): ReplyMessage => ({
  id,
  parts: [{ text: `text of ${id}`, type: 'text' }],
  role: 'assistant',
  ...extra
})

describe('submitAndAwaitReply', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('waits for the turn to end and returns the new final answer, not narration', async () => {
    let messages: ReplyMessage[] = [msg('old')]
    let busy = false

    const pending = submitAndAwaitReply(
      { busy: () => busy, messages: () => messages },
      () => {
        busy = true
        messages = [...messages, msg('narration', { pending: true })]
      },
      60_000
    )

    await vi.advanceTimersByTimeAsync(1_000)
    messages = [msg('old'), msg('narration'), msg('answer')]
    busy = false
    await vi.advanceTimersByTimeAsync(400)

    expect(await pending).toEqual({ id: 'answer', text: 'text of answer' })
  })

  it('reports an empty turn instead of re-reading an old reply', async () => {
    const pending = submitAndAwaitReply({ busy: () => false, messages: () => [msg('old')] }, () => undefined, 60_000)

    await vi.advanceTimersByTimeAsync(3_000)

    expect(await pending).toEqual({ id: null, reason: 'empty' })
  })
})
