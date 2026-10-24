import { describe, expect, it, vi } from 'vitest'

import {
  canInjectReport,
  createRealtimeEventHandler,
  NOTIFY_GRACE_MS,
  type RealtimeVoiceHandlers
} from './realtime-voice'

function setup(onAsk: RealtimeVoiceHandlers['onAsk'] = async request => `answer to ${request}`) {
  const sent: Record<string, unknown>[] = []

  const handlers = {
    onAsk: vi.fn(onAsk),
    onDelegate: vi.fn(async (request: string) => `queued ${request}`),
    onError: vi.fn(),
    onStatus: vi.fn(),
    onTranscript: vi.fn()
  }

  const handle = createRealtimeEventHandler({ send: event => sent.push(event) }, handlers)

  return { handle, handlers, sent }
}

const call = (callId: string, request: string) => ({
  arguments: JSON.stringify({ request }),
  call_id: callId,
  name: 'ask_jarvis',
  type: 'response.function_call_arguments.done'
})

describe('createRealtimeEventHandler', () => {
  it('defers a tool continuation until the active response has ended', async () => {
    const { handle, sent } = setup()
    await handle({ type: 'response.created' })
    await handle({ ...call('async-worker', 'Zrób analizę'), name: 'delegate_to_hermes' })
    expect(sent.filter(event => event.type === 'response.create')).toHaveLength(0)
    await handle({ type: 'response.done' })
    expect(sent.filter(event => event.type === 'response.create')).toHaveLength(1)
  })

  it('keeps reports queued during conversation and acknowledges only report speech', async () => {
    const { handle, handlers } = setup()
    const onReportSpoken = vi.fn()
    const voice = createRealtimeEventHandler({ send: vi.fn() }, { ...handlers, onReportSpoken })
    await voice({ type: 'response.created' })
    expect(voice.notify('report')).toBe(false)
    await voice({ type: 'response.done' })
    expect(voice.notify('report')).toBe(true)
    await voice({ type: 'input_audio_buffer.speech_started' })
    await voice({ type: 'output_audio_buffer.started' })
    expect(onReportSpoken).not.toHaveBeenCalled()
    await voice({ type: 'input_audio_buffer.speech_stopped' })
    await voice({ type: 'response.created' })
    await voice({ type: 'response.done' })
    await voice({ type: 'output_audio_buffer.stopped' })
    expect(voice.notify('report')).toBe(true)
    await voice({ type: 'output_audio_buffer.started' })
    expect(onReportSpoken).toHaveBeenCalledOnce()
    // Keep the ordinary protocol handler usable as well.
    await handle({ type: 'output_audio_buffer.stopped' })
  })

  it('recovers an overlapping-response error without closing the conversation', async () => {
    const { handle, handlers, sent } = setup()
    await handle({ type: 'error', error: { code: 'conversation_already_has_active_response' } })
    expect(handlers.onError).not.toHaveBeenCalled()
    await handle({ type: 'response.done' })
    expect(sent.at(-1)).toEqual({ type: 'response.create' })
  })
  it('runs ask_jarvis through the agent and hands the answer back before asking for speech', async () => {
    const { handle, handlers, sent } = setup()

    await handle(call('c1', 'sprawdź pocztę'))

    expect(handlers.onAsk).toHaveBeenCalledWith('sprawdź pocztę')
    expect(handlers.onStatus).toHaveBeenCalledWith('thinking')
    expect(sent).toEqual([
      {
        item: { call_id: 'c1', output: 'answer to sprawdź pocztę', type: 'function_call_output' },
        type: 'conversation.item.create'
      },
      { type: 'response.create' }
    ])
  })

  it('acknowledges delegated work through the async path without calling ask_jarvis', async () => {
    const { handle, handlers, sent } = setup()

    await handle({ ...call('d1', 'zbadaj rynek'), name: 'delegate_to_hermes' })

    expect(handlers.onDelegate).toHaveBeenCalledWith('zbadaj rynek')
    expect(handlers.onAsk).not.toHaveBeenCalled()
    expect(sent[0]).toEqual({
      item: { call_id: 'd1', output: 'queued zbadaj rynek', type: 'function_call_output' },
      type: 'conversation.item.create'
    })
    expect(sent[1]).toEqual({ type: 'response.create' })
  })

  it('answers each call once, and still answers when the agent fails', async () => {
    const { handle, sent } = setup(async () => {
      throw new Error('provider down')
    })

    await handle(call('c2', 'x'))
    await handle(call('c2', 'x'))

    expect(sent).toHaveLength(2)
    expect(JSON.stringify(sent[0])).toContain('provider down')
  })

  it('never runs the agent for a tool it does not know', async () => {
    const { handle, handlers, sent } = setup()

    await handle({ ...call('c3', 'x'), name: 'rm_rf' })

    expect(handlers.onAsk).not.toHaveBeenCalled()
    expect(sent[1]).toEqual({ type: 'response.create' })
  })

  it('follows the voice between listening and speaking', async () => {
    const { handle, handlers } = setup()

    await handle({ type: 'output_audio_buffer.started' })
    await handle({ type: 'input_audio_buffer.speech_started' })
    await handle({ type: 'response.output_audio_transcript.done', transcript: ' Gotowe. ' })

    expect(handlers.onStatus.mock.calls.map(([status]) => status)).toEqual(['speaking', 'listening'])
    expect(handlers.onTranscript).toHaveBeenCalledWith('assistant', 'Gotowe.')
  })
})

describe('canInjectReport', () => {
  it('takes a queued report at once while the model is quiet', () => {
    expect(canInjectReport('listening', 0, 1_000)).toBe(true)
  })

  it('never forces a report over the person or an ongoing spoken reply', () => {
    expect(canInjectReport('speaking', 0, 1_000)).toBe(false)
    expect(canInjectReport('speaking', 1_000, 1_000 + NOTIFY_GRACE_MS - 1)).toBe(false)
    expect(canInjectReport('speaking', 1_000, 1_000 + NOTIFY_GRACE_MS)).toBe(false)
  })

  it('never leaves a report stuck behind a model that stays in thinking', () => {
    expect(canInjectReport('thinking', 0, 5_000)).toBe(false)
    expect(canInjectReport('thinking', 5_000, 5_000 + NOTIFY_GRACE_MS)).toBe(true)
  })
})
