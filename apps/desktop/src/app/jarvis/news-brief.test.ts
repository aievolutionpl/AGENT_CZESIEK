import { describe, expect, it } from 'vitest'

import { newsReadingScript, speakable } from './news-brief'

const items = [
  { source: 'The Verge', title: 'Model <b>X</b> ships &amp; wins!' },
  { source: '', title: 'Second story.' },
  { source: 'Blog', title: '   ' },
  { source: 'Blog', title: 'Third story' }
]

describe('speakable', () => {
  it('drops tags and entities and collapses whitespace', () => {
    expect(speakable('  a <i>b</i>\n\n c &amp; d ')).toBe('a b c d')
  })
})

describe('newsReadingScript', () => {
  it('reads titles in feed order with their source, skipping blank titles', () => {
    expect(newsReadingScript(items, 'en')).toBe(
      'AI headlines. First: Model X ships wins, from The Verge. Second: Second story. Third: Third story, from Blog.'
    )
  })

  it('speaks Polish and respects the limit', () => {
    const script = newsReadingScript(items, 'pl', 1)

    expect(script.startsWith('Newsy ze świata AI. Pierwszy:')).toBe(true)
    expect(script).not.toContain('Drugi')
  })

  it('is empty when there is nothing to read', () => {
    expect(newsReadingScript([], 'en')).toBe('')
    expect(newsReadingScript([{ source: 'x', title: '  ' }], 'pl')).toBe('')
  })
})
