import { describe, expect, it, vi } from 'vitest'

import { isVoiceTool, parseToolArguments, runVoiceTool } from './tools'

const handlers = () => ({
  onAsk: vi.fn(async (request: string) => `ask:${request}`),
  onDelegate: vi.fn(async (request: string) => `delegate:${request}`),
  onTool: vi.fn(async (name: string) => `desk:${name}`)
})

describe('runVoiceTool', () => {
  it('sends chat tools to the agent and board or screen tools to the desk', async () => {
    const h = handlers()

    expect(await runVoiceTool('ask_jarvis', { request: ' co jutro? ' }, h)).toBe('ask:co jutro?')
    expect(await runVoiceTool('delegate_to_hermes', { request: 'raport' }, h)).toBe('delegate:raport')

    for (const name of ['assign_work', 'work_status', 'steer_work', 'look_at_screen']) {
      expect(await runVoiceTool(name, {}, h)).toBe(`desk:${name}`)
    }
  })

  it('never reaches a handler for an empty request or a name that is not a tool', async () => {
    const h = handlers()

    expect(await runVoiceTool('ask_jarvis', { request: '  ' }, h)).toBe('The request was empty.')
    expect(await runVoiceTool('rm_rf', {}, h)).toBe('Unknown tool: rm_rf')
    // Inherited object keys are not tools.
    expect(await runVoiceTool('toString', {}, h)).toBe('Unknown tool: toString')
    expect(isVoiceTool('constructor')).toBe(false)
    expect(h.onAsk).not.toHaveBeenCalled()
    expect(h.onTool).not.toHaveBeenCalled()
  })

  it('answers a desk tool on a surface without a desk as unknown, and turns a failure into a spoken reason', async () => {
    const { onAsk, onDelegate } = handlers()

    expect(await runVoiceTool('work_status', {}, { onAsk, onDelegate })).toBe('Unknown tool: work_status')

    const failing = { onAsk, onDelegate, onTool: async () => Promise.reject(new Error('board offline')) }

    expect(await runVoiceTool('work_status', {}, failing)).toBe('Jarvis could not finish that: board offline')
  })

  it('reads OpenAI argument strings, and treats anything malformed as an empty call', () => {
    expect(parseToolArguments('{"task_id":"t_1","stop":true}')).toEqual({ stop: true, task_id: 't_1' })
    expect(parseToolArguments('not json')).toEqual({})
    expect(parseToolArguments('[1,2]')).toEqual({})
    expect(parseToolArguments(undefined)).toEqual({})
  })
})
