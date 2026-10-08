/** What the news card reads aloud: the headlines themselves, no model call. */

const ORDINALS = {
  en: ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth'],
  pl: ['Pierwszy', 'Drugi', 'Trzeci', 'Czwarty', 'Piąty', 'Szósty']
} as const

const INTRO = { en: 'AI headlines.', pl: 'Newsy ze świata AI.' } as const
const FROM = { en: 'from', pl: 'z' } as const

/** Headlines are web text: drop tags, entities and runs of whitespace so the voice does not spell them out. */
export function speakable(text: string): string {
  return text
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(?:nbsp|amp|quot|#39);/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * The script for the first `limit` headlines, in the feed's order: an intro, then "First, <title>, from
 * <source>." for each. Empty when there is nothing to say, so the caller can skip playback.
 */
export function newsReadingScript(
  items: readonly { source: string; title: string }[],
  locale: 'en' | 'pl',
  limit = 5
): string {
  const lines = items
    .map(item => ({ source: speakable(item.source), title: speakable(item.title) }))
    .filter(item => item.title)
    .slice(0, Math.min(limit, ORDINALS[locale].length))
    .map(
      (item, index) =>
        `${ORDINALS[locale][index]}: ${item.title.replace(/[.!?…]+$/, '')}${item.source ? `, ${FROM[locale]} ${item.source}` : ''}.`
    )

  return lines.length ? [INTRO[locale], ...lines].join(' ') : ''
}
