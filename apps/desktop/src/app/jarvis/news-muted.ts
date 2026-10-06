import { atom } from 'nanostores'

import { persistString, storedString } from '@/lib/storage'

const KEY = 'czesiek:news-muted:v1'

function read(): string[] {
  try {
    const parsed: unknown = JSON.parse(storedString(KEY) ?? '[]')

    return Array.isArray(parsed) ? parsed.filter((name): name is string => typeof name === 'string') : []
  } catch {
    return []
  }
}

/** Feeds the user does not want in the rail. Hidden only here: the engine still fetches the whole feed. */
export const $newsMuted = atom<string[]>(read())

/** The items whose source is not muted. */
export function withoutMuted<T extends { source: string }>(items: readonly T[], muted: readonly string[]): T[] {
  return muted.length ? items.filter(item => !muted.includes(item.source)) : [...items]
}

export function setSourceMuted(source: string, muted: boolean): void {
  const rest = $newsMuted.get().filter(name => name !== source)
  const next = muted ? [...rest, source] : rest

  $newsMuted.set(next)
  persistString(KEY, JSON.stringify(next))
}

export function unmuteAllSources(): void {
  $newsMuted.set([])
  persistString(KEY, '[]')
}
