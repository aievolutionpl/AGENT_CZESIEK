import { describe, expect, it } from 'vitest'

import type { DeskItem } from '@/api/voice-desk'
import type { ChatMessage } from '@/lib/chat-messages/types'

import { describeDeskActivity, describeWorkProgress } from './work-progress'

describe('verified live work progress', () => {
  it('shows confirmed board states in Polish and clears completed work from the live status', () => {
    const items = [
      { title: 'Raport', verdict: 'running' },
      { title: 'Kalendarz', verdict: 'needs_you' },
      { title: 'Gotowe', verdict: 'done' }
    ] as DeskItem[]

    expect(describeDeskActivity(items, 'pl')).toBe('Raport: w toku\nKalendarz: potrzebna Twoja odpowiedź')
    expect(describeDeskActivity([{ title: 'Gotowe', verdict: 'done' }] as DeskItem[], 'pl')).toBeNull()
  })
  it('explains the active tool without sending its arguments or private reasoning to the voice', () => {
    const messages = [
      {
        role: 'assistant',
        pending: true,
        parts: [
          { type: 'reasoning', text: 'PRIVATE REASONING' },
          { type: 'tool-call', toolName: 'read_file', toolCallId: 'one', args: { path: 'PRIVATE PATH' }, argsText: '' }
        ]
      }
    ] as ChatMessage[]

    const report = describeWorkProgress({ busy: true, pending: true, messages, workers: [], lang: 'pl' })
    expect(report).toBe('Hermes sprawdza pliki.')
    expect(report).not.toMatch(/PRIVATE/)
  })

  it('reports uncertainty while waiting, never a fabricated percentage or completion', () => {
    expect(describeWorkProgress({ busy: true, pending: true, messages: [], workers: [], lang: 'pl' })).toMatch(
      /nie mam jeszcze końcowego wyniku/
    )
    expect(describeWorkProgress({ busy: false, pending: false, messages: [], workers: [], lang: 'pl' })).toBeNull()
  })
})
