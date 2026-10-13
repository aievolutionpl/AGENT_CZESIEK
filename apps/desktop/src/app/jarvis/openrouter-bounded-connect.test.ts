import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ModelOptionsResponse } from '@/types/hermes'

import { connectOpenRouter, type OpenRouterConnectDeps } from './openrouter-connect'

// Mock-only provider contracts: no live credentials or OpenRouter traffic.
const options = {
  providers: [{ slug: 'openrouter', authenticated: true, models: ['deepseek/deepseek-v4.1-flash'] }]
} as unknown as ModelOptionsResponse

function dependencies(): OpenRouterConnectDeps {
  return {
    validate: vi.fn(async () => ({ ok: true, reachable: true })),
    saveKey: vi.fn(async () => ({ ok: true })),
    loadOptions: vi.fn(async () => options),
    setDefaultModel: vi.fn(async () => ({ ok: true }))
  }
}

afterEach(() => vi.useRealTimers())
describe('mock-only bounded OpenRouter connection', () => {
  it.each(['validate', 'saveKey', 'loadOptions', 'setDefaultModel'] as const)(
    'settles a hung %s with honest persistence state and ignores its late response',
    async stage => {
      vi.useFakeTimers()
      const deps = dependencies()
      let resolve!: (value: never) => void
      deps[stage] = vi.fn(
        () =>
          new Promise<never>(done => {
            resolve = done
          })
      )
      const pending = connectOpenRouter('mock-only-key', deps, undefined, { timeoutMs: 20 })
      await vi.advanceTimersByTimeAsync(100)
      const result = await pending
      expect(result).toMatchObject({
        ok: false,
        reason: stage === 'validate' ? 'unverified' : 'failed',
        keySaved: stage === 'saveKey' ? 'unknown' : true
      })
      resolve((stage === 'validate' ? { ok: true, reachable: true } : options) as never)
      await vi.advanceTimersByTimeAsync(100)

      if (stage !== 'setDefaultModel') {
        expect(deps.setDefaultModel).not.toHaveBeenCalled()
      }
      expect(vi.getTimerCount()).toBe(0)
    }
  )

  it('cancels before save and rejects negative save acknowledgements without leaking response secrets', async () => {
    const deps = dependencies()
    const controller = new AbortController()
    deps.validate = vi.fn(async () => {
      controller.abort()

      return { ok: true, reachable: true }
    })
    expect(await connectOpenRouter('mock-only-key', deps, undefined, { signal: controller.signal })).toMatchObject({
      ok: false,
      reason: 'cancelled'
    })
    expect(deps.saveKey).not.toHaveBeenCalled()
    deps.validate = vi.fn(async () => ({ ok: true, reachable: true }))
    deps.saveKey = vi.fn(async () => ({ ok: false, message: 'mock-only-key' }))
    const result = await connectOpenRouter('mock-only-key', deps)
    expect(JSON.stringify(result)).not.toContain('mock-only-key')
    expect(result).toMatchObject({
      ok: false,
      reason: 'failed',
      keySaved: false
    })
    expect(deps.loadOptions).not.toHaveBeenCalled()
  })
})
