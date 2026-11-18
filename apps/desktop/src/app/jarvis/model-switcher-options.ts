import type { ModelOptionProvider } from '@/types/hermes'

import { WORK_MODELS } from './work-models'

export interface HermesModelGroup {
  models: string[]
  name: string
  slug: string
}

const PER_PROVIDER = 8

/**
 * What the quick switcher offers for Hermes: each usable provider's flagship models (its curated
 * shortlist when it has one, else the first few), with the model in use always present so the list
 * can show where you are even when it is not a flagship.
 */
export function hermesModelGroups(
  providers: readonly ModelOptionProvider[] | undefined,
  current: { model: string; provider: string },
  limit = PER_PROVIDER,
  query = ''
): HermesModelGroup[] {
  const groups = (providers ?? [])
    .filter(provider => provider.authenticated !== false && (provider.models?.length ?? 0) > 0)
    .map(provider => {
      const shortlist = provider.featured_models?.length ? provider.featured_models : (provider.models ?? [])
      const available = provider.models ?? []
      const recommended = Object.keys(WORK_MODELS).filter(model => available.includes(model))
      const terms = query.trim().toLowerCase().split(/[\s/-]+/).filter(Boolean)

      const models = terms.length
        ? available.filter(model => {
            const name = `${provider.name} ${model}`.toLowerCase()

            return terms.every(term => name.includes(term))
          })
        : [...new Set([...recommended, ...shortlist.filter(model => available.includes(model))])].slice(0, limit)

      if (!terms.length && current.model && provider.slug === current.provider && !models.includes(current.model)) {
        models.unshift(current.model)
      }

      return { models, name: provider.name, slug: provider.slug }
    })

  if (!query.trim() && current.model && !groups.some(group => group.slug === current.provider)) {
    groups.unshift({ models: [current.model], name: current.provider || current.model, slug: current.provider })
  }

  return groups.filter(group => group.models.length > 0)
}

/** A model id without its maker prefix: `openai/gpt-5.6` reads as `gpt-5.6`. */
export function shortModelName(model: string): string {
  return model.includes('/') ? model.slice(model.indexOf('/') + 1) : model
}
