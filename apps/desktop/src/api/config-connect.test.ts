import { afterEach, expect, it, vi } from 'vitest'

import { setEnvVar, validateProviderCredential } from './config'

// Mock-only preload contract; proves real API helpers send bounded, pinned requests.
afterEach(() => vi.unstubAllGlobals())
it('pins credential validation and saving to the requested connection/profile with a transport timeout', async () => {
  const api = vi.fn(async () => ({ ok: true, reachable: true }))
  vi.stubGlobal('hermesDesktop', { api })
  const scope = { connectionId: 'local', profile: 'onboarding-test' }
  await validateProviderCredential('OPENROUTER_API_KEY', 'mock-only-key', undefined, scope)
  await setEnvVar('OPENROUTER_API_KEY', 'mock-only-key', scope)

  for (const [request] of api.mock.calls as unknown as [
    { connectionId: string; profile: string; timeoutMs: number }
  ][]) {
    expect(request).toMatchObject(scope)
    expect(request.timeoutMs).toBeGreaterThan(0)
    expect(request.timeoutMs).toBeLessThanOrEqual(15_000)
  }

  expect(api).toHaveBeenCalledTimes(2)
})
