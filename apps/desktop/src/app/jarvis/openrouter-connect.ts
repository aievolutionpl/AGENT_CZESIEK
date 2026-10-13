/**
 * One-step OpenRouter connection: paste a key, land on a working model.
 *
 * The key is checked against OpenRouter first, but only a definite "rejected"
 * blocks — an unreachable probe (proxy, regional block, rate limit) still
 * saves for later without claiming authentication. A flaky probe must not lock
 * a legitimate user out. After saving, the served catalog decides the model:
 * the work preset (DeepSeek flash) when OpenRouter lists it, else the first
 * preset it does list.
 */

import type { ProfileScope } from '@/api/client'
import { getGlobalModelOptions, setEnvVar, setGlobalModel, validateProviderCredential } from '@/hermes'
import type { ModelOptionsResponse } from '@/types/hermes'

import { OPENROUTER_PROVIDER_SLUG, openRouterWorkModel, resolveOpenRouterPresets } from './openrouter-presets'

export const OPENROUTER_ENV_KEY = 'OPENROUTER_API_KEY'
export const OPENROUTER_KEYS_URL = 'https://openrouter.ai/keys'

export interface OpenRouterConnectDeps {
  validate: (key: string, scope?: ProfileScope) => Promise<{ message?: string; ok: boolean; reachable: boolean }>
  saveKey: (key: string, scope?: ProfileScope) => Promise<unknown>
  loadOptions: (scope?: ProfileScope) => Promise<ModelOptionsResponse>
  /** Make the chosen model the default; omitted when the caller commits it later (onboarding). */
  setDefaultModel?: (provider: string, model: string, scope?: ProfileScope) => Promise<unknown>
}

export type OpenRouterConnectResult =
  | { ok: true; model?: string; options: ModelOptionsResponse }
  | { ok: false; reason: 'empty' | 'rejected' | 'unverified' | 'failed' | 'cancelled'; keySaved?: boolean | 'unknown' }

export const defaultOpenRouterConnectDeps: OpenRouterConnectDeps = {
  loadOptions: scope => getGlobalModelOptions({ refresh: true }, scope),
  saveKey: (key, scope) => setEnvVar(OPENROUTER_ENV_KEY, key, scope),
  setDefaultModel: (provider, model, scope) => setGlobalModel(provider, model, scope),
  validate: (key, scope) => validateProviderCredential(OPENROUTER_ENV_KEY, key, undefined, scope)
}

export const OPENROUTER_CONNECT_TIMEOUT_MS = 15_000

/** Bound the whole await, including IPC backend discovery before HTTP starts.
 * Cancellation prevents subsequent writes; a write already sent may still commit.
 */
function boundedConnectOperation<T>(operation: () => Promise<T>, timeoutMs: number, signal?: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false
    const abort = () => finish(() => reject(new Error('cancelled')))
    const timer = setTimeout(() => finish(() => reject(new Error('timeout'))), timeoutMs)

    const finish = (settle: () => void) => {
      if (settled) {
        return
      }

      settled = true
      clearTimeout(timer)
      signal?.removeEventListener('abort', abort)
      settle()
    }

    if (signal?.aborted) {
      abort()

      return
    }

    signal?.addEventListener('abort', abort, { once: true })
    Promise.resolve()
      .then(() => {
        if (settled || signal?.aborted) {
          throw new Error('cancelled')
        }

        return operation()
      })
      .then(
        value => finish(() => resolve(value)),
        () => finish(() => reject(new Error('failed')))
      )
  })
}

export async function connectOpenRouter(
  rawKey: string,
  deps: OpenRouterConnectDeps,
  scope?: ProfileScope,
  { timeoutMs = OPENROUTER_CONNECT_TIMEOUT_MS, signal }: { timeoutMs?: number; signal?: AbortSignal } = {}
): Promise<OpenRouterConnectResult> {
  const key = rawKey.trim()

  if (!key) {
    return { ok: false, reason: 'empty' }
  }

  const args: [ProfileScope?] = scope === undefined ? [] : [scope]
  const run = <T>(operation: () => Promise<T>) => boundedConnectOperation(operation, timeoutMs, signal)
  let verified = false
  let keySaved: boolean | 'unknown' = false

  try {
    try {
      const probe = await run(() => deps.validate(key, ...args))

      if (probe.reachable && !probe.ok) {
        return { ok: false, reason: 'rejected' }
      }

      verified = probe.reachable && probe.ok
    } catch {
      // Connectivity failure is not rejection. Save for later, without claiming authentication.
    }

    if (signal?.aborted) {
      return { ok: false, reason: 'cancelled', keySaved }
    }

    keySaved = 'unknown'
    const saved = await run(() => deps.saveKey(key, ...args))

    if (!saved || typeof saved !== 'object' || !('ok' in saved) || saved.ok !== true) {
      return {
        ok: false,
        reason: 'failed',
        keySaved: saved && typeof saved === 'object' && 'ok' in saved && saved.ok === false ? false : 'unknown'
      }
    }

    keySaved = true

    if (!verified) {
      return { ok: false, reason: 'unverified', keySaved }
    }

    const options = await run(() => deps.loadOptions(...args))
    const provider = options.providers?.find(item => item.slug === OPENROUTER_PROVIDER_SLUG)
    const model = openRouterWorkModel(resolveOpenRouterPresets(options.providers))

    if (!model || provider?.authenticated !== true) {
      return { ok: false, reason: 'failed', keySaved }
    }

    if (deps.setDefaultModel) {
      const savedModel = await run(() => deps.setDefaultModel!(OPENROUTER_PROVIDER_SLUG, model, ...args))

      if (!savedModel || typeof savedModel !== 'object' || !('ok' in savedModel) || savedModel.ok !== true) {
        return { ok: false, reason: 'failed', keySaved }
      }
    }

    if (signal?.aborted) {
      return { ok: false, reason: 'cancelled', keySaved }
    }

    return { model, ok: true, options }
  } catch {
    return { ok: false, reason: signal?.aborted ? 'cancelled' : 'failed', keySaved }
  }
}
