import type { ModelOptionProvider } from '@/types/hermes'

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
  limit = PER_PROVIDER
): HermesModelGroup[] {
  const groups = (providers ?? [])
    .filter(provider => provider.authenticated !== false && (provider.models?.length ?? 0) > 0)
    .map(provider => {
      const shortlist = provider.featured_models?.length ? provider.featured_models : (provider.models ?? [])
      const models = shortlist.slice(0, limit)

      if (current.model && provider.slug === current.provider && !models.includes(current.model)) {
        models.unshift(current.model)
      }

      return { models, name: provider.name, slug: provider.slug }
    })

  if (current.model && !groups.some(group => group.slug === current.provider)) {
    groups.unshift({ models: [current.model], name: current.provider || current.model, slug: current.provider })
  }

  return groups
}

/** A model id without its maker prefix: `openai/gpt-5.6` reads as `gpt-5.6`. */
export function shortModelName(model: string): string {
  return model.includes('/') ? model.slice(model.indexOf('/') + 1) : model
}
