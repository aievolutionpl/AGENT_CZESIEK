import { describe, expect, it, vi } from 'vitest'

import type { ModelOptionsResponse } from '@/types/hermes'

import { connectOpenRouter, type OpenRouterConnectDeps } from './openrouter-connect'
import { checkOpenRouterConnection } from './openrouter-connection-check'

function deps(
  models: string[],
  probe = { ok: true, reachable: true }
): OpenRouterConnectDeps & {
  saveKey: ReturnType<typeof vi.fn>
  setDefaultModel: ReturnType<typeof vi.fn>
} {
  const options = {
    providers: [{ authenticated: true, models, name: 'OpenRouter', slug: 'openrouter' }]
  } as unknown as ModelOptionsResponse

  return {
    loadOptions: vi.fn(async () => options),
    saveKey: vi.fn(async () => ({ ok: true })),
    setDefaultModel: vi.fn(async () => ({ ok: true })),
    validate: vi.fn(async () => probe)
  }
}

describe('connectOpenRouter', () => {
  it('saves the key and makes the served DeepSeek flash model the default', async () => {
    const d = deps(['openai/gpt-5.5', 'deepseek/deepseek-v4.1-flash'])
    const result = await connectOpenRouter('  sk-or-1  ', d)

    expect(d.saveKey).toHaveBeenCalledWith('sk-or-1')
    expect(result).toMatchObject({ model: 'deepseek/deepseek-v4.1-flash', ok: true })
    expect(d.setDefaultModel).toHaveBeenCalledWith('openrouter', 'deepseek/deepseek-v4.1-flash')
  })

  it('never saves a key OpenRouter definitely rejected', async () => {
    const d = deps(['deepseek/deepseek-v4.1-flash'], { ok: false, reachable: true })

    expect(await connectOpenRouter('bad', d)).toMatchObject({ ok: false, reason: 'rejected' })
    expect(d.saveKey).not.toHaveBeenCalled()
  })

  it('still saves when the probe cannot reach OpenRouter', async () => {
    const d = deps(['deepseek/deepseek-v4.1-flash'], { ok: false, reachable: false })

    expect((await connectOpenRouter('sk-or-2', d)).ok).toBe(true)
    expect(d.saveKey).toHaveBeenCalledWith('sk-or-2')
  })

  it('does nothing for an empty key', async () => {
    const d = deps([])

    expect(await connectOpenRouter('   ', d)).toEqual({ ok: false, reason: 'empty' })
    expect(d.validate).not.toHaveBeenCalled()
  })
})

describe('checkOpenRouterConnection', () => {
  it.each([
    [{ ok: false, reachable: true, status: 401 }, 'invalid_credentials'],
    [{ ok: false, reachable: true, status: 402 }, 'insufficient_credit']
  ] as const)('keeps provider failures distinct', async (probe, reason) => {
    const result = await checkOpenRouterConnection(
      {
        loadOptions: vi.fn(),
        validate: vi.fn(async () => probe)
      },
      { connectionId: 'local', profile: 'default' }
    )

    expect(result).toMatchObject({ ok: false, reason })
  })

  it('does not call model discovery after a timeout', async () => {
    const loadOptions = vi.fn()

    const result = await checkOpenRouterConnection({
      loadOptions,
      validate: vi.fn(async () => {
        throw new Error('request timed out')
      })
    })

    expect(result).toMatchObject({ ok: false, reason: 'timeout' })
    expect(loadOptions).not.toHaveBeenCalled()
  })

  it('reports an unavailable model separately', async () => {
    const result = await checkOpenRouterConnection({
      loadOptions: vi.fn(async () => ({ providers: [] }) as unknown as ModelOptionsResponse),
      validate: vi.fn(async () => ({ ok: true, reachable: true }))
    })

    expect(result).toEqual({ ok: false, reason: 'unavailable_model' })
  })
})
