import { atom } from 'nanostores'

import { persistString, storedString } from '@/lib/storage'

const KEY = 'czesiek:news-read:v1'
/** Old headlines fall out of the feed, so remembering a few hundred links is plenty. */
export const NEWS_READ_CAP = 300

function read(): string[] {
  try {
    const parsed: unknown = JSON.parse(storedString(KEY) ?? '[]')

    return Array.isArray(parsed) ? parsed.filter((link): link is string => typeof link === 'string') : []
  } catch {
    return []
  }
}

/** Links of headlines the user opened or marked read, newest last. */
export const $newsRead = atom<string[]>(read())

/** The read list with `links` added, capped to the newest entries; unchanged (same array) when nothing is new. */
export function withRead(current: readonly string[], links: readonly string[]): readonly string[] {
  const fresh = links.filter(link => !current.includes(link))

  return fresh.length ? [...current, ...fresh].slice(-NEWS_READ_CAP) : current
}

export function markNewsRead(links: readonly string[]): void {
  const current = $newsRead.get()
  const next = withRead(current, links)

  if (next !== current) {
    $newsRead.set([...next])
    persistString(KEY, JSON.stringify(next))
  }
}
