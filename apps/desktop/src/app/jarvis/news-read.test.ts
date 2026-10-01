// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import { $newsRead, markNewsRead, NEWS_READ_CAP, withRead } from './news-read'

describe('news read list', () => {
  it('adds only what is new and hands back the same list when nothing is', () => {
    const current = ['a']

    expect(withRead(current, ['a'])).toBe(current)
    expect(withRead(current, ['a', 'b'])).toEqual(['a', 'b'])
  })

  it('keeps the newest entries within the cap', () => {
    const many = Array.from({ length: NEWS_READ_CAP + 20 }, (_, i) => `l${i}`)
    const next = withRead([], many)

    expect(next).toHaveLength(NEWS_READ_CAP)
    expect(next.at(-1)).toBe(`l${NEWS_READ_CAP + 19}`)
  })

  it('remembers across reloads', () => {
    markNewsRead(['https://x/1'])

    expect(JSON.parse(window.localStorage.getItem('czesiek:news-read:v1') ?? '[]')).toEqual($newsRead.get())
    expect($newsRead.get()).toContain('https://x/1')
  })
})
