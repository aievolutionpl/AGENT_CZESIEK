import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  cancelVoiceTask: vi.fn(async () => ({ cancelled: true, status: 'archived', task_id: 't1' })),
  describeScreen: vi.fn(async () => ({ text: '<external-data source="screen">Faktura</external-data>' })),
  dispatchVoiceWork: vi.fn(async () => ({ text: 'Przekazano do „default”, zadanie t1.' })),
  getVoiceDesk: vi.fn(async () => ({ text: 'Stan tablicy potwierdzony przez backend: 0 w toku.' })),
  getVoiceTask: vi.fn(async () => ({ text: 'Zadanie t1: W TOKU' })),
  steerVoiceTask: vi.fn(async () => ({ resumed: true, task_id: 't1' }))
}))

vi.mock('@/api/voice-desk', () => api)

import { createDeskTools } from './desk-tools'

const make = (over: Partial<Parameters<typeof createDeskTools>[0]> = {}) =>
  createDeskTools({ lang: () => 'pl', sessionId: () => 's1', ...over })

beforeEach(() => vi.clearAllMocks())

describe('desk tools', () => {
  it('hands a job to the board tagged with this conversation, and never invents a priority', async () => {
    const tools = make()

    expect(await tools('assign_work', { details: ' sektor AI ', priority: 'wysoki', title: ' Research ' })).toMatch(
      /t1/
    )
    expect(api.dispatchVoiceWork).toHaveBeenCalledWith({
      assignee: undefined,
      details: 'sektor AI',
      lang: 'pl',
      priority: 0,
      session_id: 's1',
      title: 'Research'
    })
  })

  it('reads the whole board, or one task when an id is given', async () => {
    const tools = make({ lang: () => 'en' })

    expect(await tools('work_status', {})).toMatch(/^Stan tablicy/)
    expect(api.getVoiceDesk).toHaveBeenCalledWith('en')
    expect(await tools('work_status', { task_id: 't1' })).toBe('Zadanie t1: W TOKU')
    expect(api.getVoiceTask).toHaveBeenCalledWith('t1', 'en')
  })

  it('steers with words, stops on request, and asks for what is missing instead of guessing', async () => {
    const tools = make()

    expect(await tools('steer_work', { instruction: 'chodzi o Kowalskiego', task_id: 't1' })).toMatch(/wznowione/)
    expect(api.steerVoiceTask).toHaveBeenCalledWith('t1', 'chodzi o Kowalskiego')
    expect(await tools('steer_work', { stop: true, task_id: 't1' })).toMatch(/zatrzymane/)
    expect(await tools('steer_work', { instruction: 'x' })).toMatch(/Które zadanie/)
    expect(await tools('steer_work', { task_id: 't1' })).toMatch(/nowego kierunku/)
    expect(api.steerVoiceTask).toHaveBeenCalledTimes(1)
  })

  it('looks only when it can, tells the user before it captures, and says so when it is blind', async () => {
    const order: string[] = []

    const capture = vi.fn(async () => {
      order.push('capture')

      return 'data:image/jpeg;base64,AAAA'
    })

    const looking = make({ capture, onLook: () => order.push('notify') })

    expect(await looking('look_at_screen', { question: 'Co to za faktura?' })).toMatch(/Faktura/)
    expect(order).toEqual(['notify', 'capture'])
    expect(api.describeScreen).toHaveBeenCalledWith('data:image/jpeg;base64,AAAA', 'Co to za faktura?', 'pl')

    api.describeScreen.mockClear()

    expect(await make({ capture: async () => null })('look_at_screen', { question: 'x' })).toMatch(/Nie widzę/)
    expect(await make()('look_at_screen', { question: 'x' })).toMatch(/Nie widzę/)
    expect(api.describeScreen).not.toHaveBeenCalled()
  })
})
