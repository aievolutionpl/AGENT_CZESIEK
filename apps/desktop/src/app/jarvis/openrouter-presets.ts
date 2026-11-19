/**
 * Ready-made OpenRouter picks for work — "DeepSeek" (the recommended work
 * default: fast, cheap, strong at tools), "GPT", "Claude", "Gemini", "Hermes",
 * "free" — resolved against the catalog the backend actually serves.
 *
 * A preset is a ranked list of id prefixes, not a pinned model id: the catalog
 * moves every few weeks, and a hardcoded id would quietly start 404'ing. Each
 * preset takes the first catalog model matching its best prefix (the catalog
 * is curated newest-first), and a preset with no match is simply not offered.
 */

import type { ModelOptionProvider } from '@/types/hermes'

export const OPENROUTER_PROVIDER_SLUG = 'openrouter'

export type OpenRouterPresetId = 'claude' | 'deepseek' | 'free' | 'gemini' | 'gpt' | 'hermes'

/** The preset a fresh OpenRouter connection starts on. */
export const OPENROUTER_WORK_PRESET: OpenRouterPresetId = 'deepseek'

interface OpenRouterPresetSpec {
  id: OpenRouterPresetId
  /** Tried in order; the first prefix with any match wins. */
  prefixes: readonly string[]
}

const PRESETS: readonly OpenRouterPresetSpec[] = [
  {
    id: 'deepseek',
    prefixes: [
      'deepseek/deepseek-v4.1-flash',
      'deepseek/deepseek-v4-flash',
      'deepseek/deepseek-v4',
      'deepseek/deepseek'
    ]
  },
  { id: 'gpt', prefixes: ['openai/gpt-6', 'openai/gpt-5.6', 'openai/gpt-5.5', 'openai/gpt-5', 'openai/gpt'] },
  { id: 'claude', prefixes: ['anthropic/claude-sonnet', 'anthropic/claude-opus', 'anthropic/claude'] },
  { id: 'gemini', prefixes: ['google/gemini-3.8-flash', 'google/gemini-3', 'google/gemini'] },
  { id: 'hermes', prefixes: ['nousresearch/hermes-4', 'nousresearch/hermes'] },
  { id: 'free', prefixes: [''] }
]

/** Routing/billing variants and dated snapshots of a base model — not what "the GPT preset" means. */
const VARIANT_SUFFIX = /-(fast|flex|pro-fast|pro-flex|contributor|\d{4})$/

function candidate(model: string, preset: OpenRouterPresetId): boolean {
  const free = model.endsWith(':free')

  if (preset === 'free') {
    return free
  }

  return !free && !VARIANT_SUFFIX.test(model)
}

export interface OpenRouterPreset {
  id: OpenRouterPresetId
  model: string
}

export interface OpenRouterPresetState {
  /** OpenRouter is configured and lists models. */
  connected: boolean
  presets: OpenRouterPreset[]
}

export function findOpenRouterProvider(
  providers: readonly ModelOptionProvider[] | undefined
): ModelOptionProvider | undefined {
  return providers?.find(provider => provider.slug === OPENROUTER_PROVIDER_SLUG)
}

export function resolveOpenRouterPresets(providers: readonly ModelOptionProvider[] | undefined): OpenRouterPresetState {
  const provider = findOpenRouterProvider(providers)
  const models = provider?.models ?? []

  // An unauthenticated row may still carry the curated static list; offering
  // it would fail on the first turn, so it counts as not connected.
  if (!provider || provider.authenticated === false || models.length === 0) {
    return { connected: false, presets: [] }
  }

  const presets: OpenRouterPreset[] = []

  for (const spec of PRESETS) {
    for (const prefix of spec.prefixes) {
      const model = models.find(id => id.startsWith(prefix) && candidate(id, spec.id))

      if (model) {
        presets.push({ id: spec.id, model })

        break
      }
    }
  }

  return { connected: true, presets }
}

/** The three work modes, as Hermes reasoning levels. */
export const JARVIS_WORK_MODES = [
  { effort: 'low', id: 'fast' },
  { effort: 'medium', id: 'balanced' },
  { effort: 'high', id: 'deep' }
] as const

export type JarvisWorkModeId = (typeof JARVIS_WORK_MODES)[number]['id']

/** Which mode a stored reasoning level belongs to (levels between collapse). */
export function workModeForEffort(effort: string): JarvisWorkModeId {
  const value = effort.trim().toLowerCase()

  if (value === 'minimal' || value === 'low' || value === 'none') {
    return 'fast'
  }

  if (value === 'high' || value === 'xhigh' || value === 'max' || value === 'ultra') {
    return 'deep'
  }

  return 'balanced'
}

/** The model a fresh OpenRouter connection should start on: the work preset, else the first preset. */
export function openRouterWorkModel(state: OpenRouterPresetState): string | undefined {
  return (state.presets.find(preset => preset.id === OPENROUTER_WORK_PRESET) ?? state.presets[0])?.model
}
