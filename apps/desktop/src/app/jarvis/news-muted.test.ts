// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'

import { $newsMuted, setSourceMuted, unmuteAllSources, withoutMuted } from './news-muted'

afterEach(() => {
  unmuteAllSources()
  window.localStorage.clear()
})

describe('muted news sources', () => {
  it('drops exactly the muted sources and keeps the rest in order', () => {
    const items = [{ source: 'A' }, { source: 'B' }, { source: 'A' }, { source: 'C' }]

    expect(withoutMuted(items, ['A'])).toEqual([{ source: 'B' }, { source: 'C' }])
    expect(withoutMuted(items, [])).toEqual(items)
  })

  it('mutes once, unmutes, and remembers across a reload', () => {
    setSourceMuted('A', true)
    setSourceMuted('A', true)

    expect($newsMuted.get()).toEqual(['A'])
    expect(JSON.parse(window.localStorage.getItem('czesiek:news-muted:v1') ?? '[]')).toEqual(['A'])

    setSourceMuted('A', false)

    expect($newsMuted.get()).toEqual([])
  })
})
