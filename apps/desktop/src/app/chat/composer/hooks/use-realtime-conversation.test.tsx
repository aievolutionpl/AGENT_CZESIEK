// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'

import type * as IntroMusic from '@/lib/jarvis-intro-music'
import type { RealtimeVoiceHandlers } from '@/lib/realtime-voice'
import { $subagentsBySession, type SubagentProgress } from '@/store/subagents'

import type { ReplyMessage } from './agent-reply'
import { useRealtimeConversation } from './use-realtime-conversation'

const mocks = vi.hoisted(() => ({
  music: vi.fn(),
  dispatch: vi.fn(async () => ({ task_id: 'parallel', text: 'Przekazano zadanie parallel.' })),
  handlers: null as RealtimeVoiceHandlers | null,
  notify: vi.fn((_text: string) => true),
  request: vi.fn(async () => ({ found: true, status: 'queued' }))
}))

vi.mock('@/lib/jarvis-intro-music', async importOriginal => ({
  ...(await importOriginal<typeof IntroMusic>()),
  startJarvisIntroMusic: mocks.music
}))

vi.mock('@/api/voice-desk', () => ({
  getVoiceDesk: async () => ({ items: [], text: 'Tablica bez zadań' }),
  dispatchVoiceWork: mocks.dispatch
}))

vi.mock('@/lib/live-voice/start', () => ({
  startLiveVoice: async (handlers: RealtimeVoiceHandlers) => {
    mocks.handlers = handlers

    return { notify: mocks.notify, setMuted: vi.fn(), stop: vi.fn() }
  }
}))
vi.mock('@/store/session-states', () => ({ requestForOwnedSession: mocks.request }))
vi.mock('@/store/notifications', () => ({ notify: vi.fn(), notifyError: vi.fn() }))
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.useRealTimers()
  vi.clearAllMocks()
  mocks.notify.mockImplementation(() => true)
  $subagentsBySession.set({})
})

/** Let `ms` of fake time pass, flushing the promises the timers resolve. */
const flush = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

test('microphone peaks and assistant transcripts never trigger music; the user phrase does', async () => {
  vi.useFakeTimers()
  render({ busy: () => false, messages: () => [], onSubmit: vi.fn() })
  await flush(0)
  await act(async () => {
    mocks.handlers!.onStatus('listening')

    for (const [time, level] of [
      [0, 0.02],
      [80, 0.55],
      [140, 0.04],
      [370, 0.02],
      [420, 0.6],
      [485, 0.03]
    ]) {
      vi.setSystemTime(time)
      vi.spyOn(performance, 'now').mockReturnValue(time)
      mocks.handlers!.onLevel!(level)
    }

    mocks.handlers!.onTranscript?.('assistant', 'Tatuś wrócił')
    mocks.handlers!.onTranscript?.('user', 'Witaj, Cześku')
  })
  expect(mocks.music).not.toHaveBeenCalled()
  await act(async () => {
    mocks.handlers!.onTranscript?.('user', 'Tatuś wrócił!')
  })
  expect(mocks.music).toHaveBeenCalledOnce()
  vi.restoreAllMocks()
})

const answer = (id: string, text: string): ReplyMessage => ({
  id,
  parts: [{ text, type: 'text' }],
  role: 'assistant'
})

function render(args: {
  busy: () => boolean
  messages: () => readonly ReplyMessage[]
  markSpoken?: (id: string) => void
  onSubmit: () => Promise<void> | void
  sessionId?: string | null
}) {
  return renderHook(
    ({ sessionId }: { sessionId: string | null }) =>
      useRealtimeConversation({
        sessionId,
        enabled: true,
        failureLabel: 'error',
        busy: args.busy,
        messages: args.messages,
        markSpoken: args.markSpoken ?? vi.fn(),
        onFatalError: vi.fn(),
        onSubmit: args.onSubmit
      }),
    { initialProps: { sessionId: args.sessionId === undefined ? 's1' : args.sessionId } }
  )
}

test('reports foreground work started before the voice conversation and keeps its controls available', async () => {
  vi.useFakeTimers()
  const onSubmit = vi.fn()
  const { result } = render({ busy: () => true, messages: () => [], onSubmit })
  await flush(15_600)

  expect(mocks.notify).toHaveBeenCalledWith(expect.stringContaining('Hermes'))
  expect(result.current.workProgress).toContain('Hermes')
  expect(onSubmit).not.toHaveBeenCalled()
})

test('answers ask_jarvis inline when the reply lands inside the budget', async () => {
  vi.useFakeTimers()
  const messages: ReplyMessage[] = []
  const markSpoken = vi.fn()
  let busy = false

  const onSubmit = vi.fn(() => {
    messages.push(answer('answer', 'Masz jutro dwa spotkania.'))
  })

  render({ busy: () => busy, messages: () => messages, markSpoken, onSubmit })
  await flush(0)

  const spoken = mocks.handlers!.onAsk('Co mam jutro?')

  await flush(600)
  await expect(spoken).resolves.toBe('Masz jutro dwa spotkania.')
  expect(onSubmit).toHaveBeenCalledOnce()
  expect(markSpoken).toHaveBeenCalledWith('answer')

  // Nothing was queued: the model got the answer as the tool result.
  await flush(2_000)
  expect(mocks.notify).not.toHaveBeenCalled()
  expect(busy).toBe(false)
})

test('releases the model right away when Hermes is slow, then voices the answer it landed on', async () => {
  vi.useFakeTimers()
  const messages: ReplyMessage[] = []
  const markSpoken = vi.fn()
  let busy = false

  const onSubmit = vi.fn(() => {
    busy = true
  })

  render({ busy: () => busy, messages: () => messages, markSpoken, onSubmit })
  await flush(0)

  const spoken = mocks.handlers!.onAsk('Zrób raport')

  await flush(7_000)
  await expect(spoken).resolves.toBe('Sprawdzam. Powiem, jak będę wiedział.')
  expect(mocks.notify).not.toHaveBeenCalled()

  messages.push(answer('late', 'Raport gotowy: trzy pliki.'))
  busy = false
  await flush(1_000)

  expect(markSpoken).not.toHaveBeenCalled()
  mocks.handlers!.onReportSpoken?.()
  expect(markSpoken).toHaveBeenCalledWith('late')
  expect(mocks.notify).toHaveBeenCalledWith('Raport gotowy: trzy pliki.')
})

test('hands the tool answer back at the inline budget, never at the five-minute ceiling', async () => {
  vi.useFakeTimers()
  const messages: ReplyMessage[] = []
  let busy = false

  const onSubmit = vi.fn(() => {
    busy = true

    return new Promise<void>(() => undefined)
  })

  render({ busy: () => busy, messages: () => messages, onSubmit })
  await flush(0)

  let settled = false

  const spoken = mocks.handlers!.onAsk('Zbadaj rynek').then(value => {
    settled = true

    return value
  })

  await flush(3_200)
  expect(settled).toBe(false)

  await flush(400)
  expect(settled).toBe(true)
  await expect(spoken).resolves.toBe('Sprawdzam. Powiem, jak będę wiedział.')

  // The turn never finishes: after the hard five-minute limit the queue gets
  // an honest note instead of a silent report.
  await flush(300_000)
  await flush(1_000)
  expect(mocks.notify).toHaveBeenCalledWith(expect.stringContaining('nie potwierdzam sukcesu'))
})

test('keeps a report queued while the model speaks and delivers it, once, when it is free', async () => {
  vi.useFakeTimers()
  const messages: ReplyMessage[] = []
  const markSpoken = vi.fn()
  const report = 'Raport zapisany w wynik.txt'
  let busy = false
  let modelSpeaking = false

  const onSubmit = vi.fn(() => {
    busy = true
  })

  mocks.notify.mockImplementation(() => !modelSpeaking)

  render({ busy: () => busy, messages: () => messages, markSpoken, onSubmit })
  await flush(0)
  await act(async () => mocks.handlers!.onDelegate('Zrób raport'))

  // The result lands while the model is mid-sentence.
  modelSpeaking = true
  messages.push(answer('answer', report))
  busy = false
  await flush(2_000)

  expect(markSpoken).not.toHaveBeenCalled()
  expect(mocks.notify).toHaveBeenCalledWith(report)

  // Still speaking: every drain tick retries instead of dropping the report.
  mocks.notify.mockClear()
  await flush(2_000)
  expect(mocks.notify.mock.calls.length).toBeGreaterThanOrEqual(4)
  expect(mocks.notify.mock.calls.every(([text]) => text === report)).toBe(true)
  expect(mocks.notify.mock.results.every(result => result.value === false)).toBe(true)

  // The model goes quiet: the report goes in exactly once and the queue empties.
  modelSpeaking = false
  mocks.notify.mockClear()
  await flush(400)
  expect(mocks.notify).toHaveBeenCalledWith(report)
  mocks.handlers!.onReportSpoken?.()
  expect(markSpoken).toHaveBeenCalledWith('answer')

  mocks.notify.mockClear()
  await flush(2_000)
  expect(mocks.notify).not.toHaveBeenCalled()
})

test('acknowledges delegated work in one short, jargon-free sentence', async () => {
  vi.useFakeTimers()
  const messages: ReplyMessage[] = []
  let busy = false

  const onSubmit = vi.fn(() => {
    busy = true
  })

  render({ busy: () => busy, messages: () => messages, onSubmit })
  await flush(0)

  const acknowledgement = await act(async () => mocks.handlers!.onDelegate('Zrób raport'))

  expect(onSubmit).toHaveBeenCalledOnce()
  expect(acknowledgement).toBe('Przekazuję zadanie do wykonania i powiem, gdy pojawi się wynik.')
  expect((acknowledgement.match(/\./g) ?? []).length).toBe(1)
  expect(acknowledgement).not.toMatch(/backend|zlecenie|ukończenia/i)
})

test('queues a second request independently instead of dropping it into the busy composer', async () => {
  vi.useFakeTimers()
  const onSubmit = vi.fn()
  render({ busy: () => true, messages: () => [], onSubmit })
  await flush(0)
  await expect(mocks.handlers!.onAsk('Sprawdź jeszcze kalendarz')).resolves.toContain('parallel')
  await expect(mocks.handlers!.onDelegate('Przygotuj drugą analizę')).resolves.toContain('parallel')
  expect(onSubmit).not.toHaveBeenCalled()
  expect(mocks.dispatch).toHaveBeenCalledWith(
    expect.objectContaining({ session_id: 's1', details: 'Sprawdź jeszcze kalendarz' })
  )
  expect(mocks.dispatch).toHaveBeenCalledTimes(2)
})

test('adopts the first slow reply when the chat is created before the inline budget expires', async () => {
  vi.useFakeTimers()
  const messages: ReplyMessage[] = []
  let busy = false

  const { rerender } = render({
    busy: () => busy,
    messages: () => messages,
    onSubmit: () => {
      busy = true
    },
    sessionId: null
  })

  await flush(0)
  const result = mocks.handlers!.onAsk('Pierwsze zadanie')
  await flush(500)
  rerender({ sessionId: 'created-early' })
  await flush(3_500)
  await expect(result).resolves.toContain('Sprawdzam')
  messages.push(answer('first-result', 'Wynik pierwszego zadania'))
  busy = false
  await flush(1_000)
  expect(mocks.notify).toHaveBeenCalledWith('Wynik pierwszego zadania')
})

test('ordinary speech never acknowledges a pending report; only report audio does', async () => {
  vi.useFakeTimers()
  const messages: ReplyMessage[] = []
  const markSpoken = vi.fn()
  let busy = false
  render({
    busy: () => busy,
    messages: () => messages,
    markSpoken,
    onSubmit: () => {
      busy = true
    }
  })
  await flush(0)
  await mocks.handlers!.onDelegate('Praca w tle')
  messages.push(answer('verified', 'Potwierdzony wynik'))
  busy = false
  await flush(800)
  mocks.handlers!.onStatus('speaking')
  expect(markSpoken).not.toHaveBeenCalled()
  mocks.handlers!.onReportSpoken?.()
  expect(markSpoken).toHaveBeenCalledWith('verified')
})

test('reports waiting work and eventually times out even when submission never resolves', async () => {
  vi.useFakeTimers()
  render({ busy: () => false, messages: () => [], onSubmit: () => new Promise<void>(() => undefined) })
  await flush(0)
  await mocks.handlers!.onDelegate('Przygotuj analizę')
  await flush(20_400)
  expect(mocks.notify).toHaveBeenCalledWith(expect.stringContaining('confirmed result'))
  mocks.handlers!.onReportSpoken?.()
  mocks.notify.mockClear()
  await flush(280_600)
  expect(mocks.notify).toHaveBeenCalledWith(expect.stringContaining('Nie otrzymałem jeszcze potwierdzonego wyniku'))
})

test('adopts a slow answer when the conversation is created, but never voices one from another', async () => {
  vi.useFakeTimers()
  const messages: ReplyMessage[] = []
  let busy = false

  const onSubmit = vi.fn(() => {
    busy = true
  })

  const { rerender } = render({ busy: () => busy, messages: () => messages, onSubmit, sessionId: null })
  await flush(0)

  const spoken = mocks.handlers!.onAsk('Przygotuj raport')

  await flush(7_000)
  await expect(spoken).resolves.toBe('Sprawdzam. Powiem, jak będę wiedział.')

  // The composer's own conversation is created while Hermes is still working.
  rerender({ sessionId: 'created' })
  messages.push(answer('adopted', 'Potwierdzony wynik'))
  busy = false
  await flush(2_000)
  expect(mocks.notify).toHaveBeenCalledWith('Potwierdzony wynik')

  // A second slow answer, but this time the conversation is switched away.
  mocks.notify.mockClear()
  busy = false
  const other = mocks.handlers!.onAsk('Kolejny raport')

  await flush(7_000)
  await expect(other).resolves.toBe('Sprawdzam. Powiem, jak będę wiedział.')

  rerender({ sessionId: 'other' })
  messages.push(answer('elsewhere', 'Inna rozmowa'))
  busy = false
  await flush(3_000)
  expect(mocks.notify).not.toHaveBeenCalled()
})

test('reports an empty turn inline instead of inventing an answer', async () => {
  vi.useFakeTimers()
  const messages: ReplyMessage[] = [answer('old', 'Stara odpowiedź')]
  const onSubmit = vi.fn()

  render({ busy: () => false, messages: () => messages, onSubmit })
  await flush(0)

  const spoken = mocks.handlers!.onAsk('Cokolwiek')

  await flush(3_000)
  await expect(spoken).resolves.toBe('Hermes nie zwrócił odpowiedzi.')
  expect(mocks.notify).not.toHaveBeenCalled()
})

test.each([
  ['zatrzymaj zadanie', 'interrupt'],
  ['zmień polecenie: zapisz CSV', 'steer']
])('spoken control %s targets the session-owned worker', async (request, method) => {
  vi.useFakeTimers()

  const item: SubagentProgress = {
    id: 'worker',
    goal: 'Report',
    parentId: null,
    status: 'running',
    taskCount: 1,
    taskIndex: 0,
    startedAt: 0,
    updatedAt: 0,
    filesRead: [],
    filesWritten: [],
    stream: []
  }

  $subagentsBySession.set({ s1: [item] })
  const onSubmit = vi.fn()

  render({ busy: () => true, messages: () => [], onSubmit })
  await flush(0)
  const reply = await mocks.handlers!.onDelegate(request)

  expect(mocks.request).toHaveBeenCalledWith('s1', expect.any(Function), `subagent.${method}`, {
    session_id: 's1',
    subagent_id: 'worker',
    ...(method === 'steer' ? { text: request } : {})
  })
  expect(reply).toContain(method === 'interrupt' ? 'poczekaj na potwierdzenie' : 'Zmiana została przekazana')
  expect(onSubmit).not.toHaveBeenCalled()
})
