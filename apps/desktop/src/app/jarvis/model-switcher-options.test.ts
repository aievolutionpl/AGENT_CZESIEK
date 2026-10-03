import { describe, expect, it } from 'vitest'

import type { ModelOptionProvider } from '@/types/hermes'

import { hermesModelGroups, shortModelName } from './model-switcher-options'
import { WORK_MODELS } from './work-models'

const provider = (over: Partial<ModelOptionProvider>): ModelOptionProvider =>
  ({ authenticated: true, models: ['a', 'b', 'c'], name: 'P', slug: 'p', ...over }) as ModelOptionProvider

describe('hermesModelGroups', () => {
  it('only recommends models available in the authenticated catalogue and searches beyond the shortlist', () => {
    const recommended = Object.keys(WORK_MODELS)[0]

    const providers = [
      provider({
        models: ['ordinary', recommended, 'hidden-search-result'],
        featured_models: ['ordinary', 'unavailable']
      })
    ]

    const groups = hermesModelGroups(providers, { model: '', provider: '' })
    expect(groups[0].models).toEqual([recommended, 'ordinary'])
    expect(hermesModelGroups(providers, { model: '', provider: '' }, 1, 'hidden')[0].models).toEqual([
      'hidden-search-result'
    ])
    expect(
      hermesModelGroups([provider({ authenticated: false, models: [recommended] })], { model: '', provider: '' })
    ).toEqual([])
    expect(hermesModelGroups(providers, { model: '', provider: '' }, 1, 'not-found')).toEqual([])
  })
  it('skips providers that cannot be used, and prefers a curated shortlist', () => {
    const groups = hermesModelGroups(
      [
        provider({ featured_models: ['b'], slug: 'one' }),
        provider({ authenticated: false, slug: 'two' }),
        provider({ models: [], slug: 'three' })
      ],
      { model: 'b', provider: 'one' }
    )

    expect(groups).toEqual([{ models: ['b'], name: 'P', slug: 'one' }])
  })

  it('always shows the model in use, inside its provider or as a group of its own', () => {
    const inside = hermesModelGroups([provider({ slug: 'p' })], { model: 'zzz', provider: 'p' }, 2)

    expect(inside[0].models).toEqual(['zzz', 'a', 'b'])

    const alone = hermesModelGroups([provider({ slug: 'p' })], { model: 'x', provider: 'custom' })

    expect(alone[0]).toEqual({ models: ['x'], name: 'custom', slug: 'custom' })
    expect(hermesModelGroups(undefined, { model: '', provider: '' })).toEqual([])
  })
})

describe('shortModelName', () => {
  it('drops only the maker prefix', () => {
    expect(shortModelName('openai/gpt-5.6')).toBe('gpt-5.6')
    expect(shortModelName('gpt-realtime')).toBe('gpt-realtime')
  })
})
