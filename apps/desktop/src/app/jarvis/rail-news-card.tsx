import { useStore } from '@nanostores/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'

import { createVaultNote, VAULT_RAIL_KEY } from '@/api/vault'
import { Button } from '@/components/ui/button'
import { getAiNews } from '@/hermes'
import { useI18n } from '@/i18n'
import { Bookmark, Checks, EyeOff, Loader2, RefreshCw, Sparkles, Zap } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { notify, notifyError } from '@/store/notifications'

import { requestComposerInsert } from '../chat/composer/focus'

import { $newsMuted, setSourceMuted, unmuteAllSources, withoutMuted } from './news-muted'
import { $newsRead, markNewsRead } from './news-read'
import { RailCard } from './rail-card'

const NEWS_REFRESH_MS = 15 * 60_000
const NEWS_FETCH = 15
const NEWS_SHOWN = 5
const SOURCE_CHIPS = 4
const NEWS_FOLDER = 'Newsy'

const COPY = {
  en: {
    all: 'All',
    ask: 'Ask Czesiek about this',
    askPrompt: (title: string, link: string) =>
      `Summarise this in three sentences and tell me what it means for my work: ${title} ${link}`,
    brief: 'Brief me',
    briefPrompt: (titles: string) =>
      `Brief me on these AI headlines in a few sentences and tell me which one matters most for my work:\n${titles}`,
    less: 'Show less',
    markAll: 'Mark all as read',
    mute: (name: string) => `Hide ${name}`,
    muted: (n: number) => `${n} hidden source${n === 1 ? '' : 's'} · show`,
    more: (n: number) => `Show ${n} more`,
    saved: 'Saved to memory',
    savedAlready: 'Already in memory',
    save: 'Save to memory',
    title: 'AI news',
    sources: 'Sources'
  },
  pl: {
    all: 'Wszystkie',
    ask: 'Zapytaj Cześka o to',
    askPrompt: (title: string, link: string) =>
      `Streść to w trzech zdaniach i powiedz, co to oznacza dla mojej pracy: ${title} ${link}`,
    brief: 'Podsumuj newsy',
    briefPrompt: (titles: string) =>
      `Podsumuj te newsy AI w kilku zdaniach i powiedz, który jest najważniejszy dla mojej pracy:\n${titles}`,
    less: 'Pokaż mniej',
    markAll: 'Oznacz wszystko jako przeczytane',
    mute: (name: string) => `Ukryj: ${name}`,
    muted: (n: number) => `Ukryte źródła: ${n} · pokaż`,
    more: (n: number) => `Pokaż jeszcze ${n}`,
    saved: 'Zapisano w pamięci',
    savedAlready: 'Już jest w pamięci',
    save: 'Zapisz w pamięci',
    title: 'Newsy AI',
    sources: 'Źródła'
  }
} as const

/** Most frequent sources first, so the chips are the feeds that actually have headlines. */
export function topSources(items: readonly { source: string }[], limit = SOURCE_CHIPS): string[] {
  const counts = new Map<string, number>()

  for (const { source } of items) {
    counts.set(source, (counts.get(source) ?? 0) + 1)
  }

  return [...counts]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([name]) => name)
}

function relativeAge(publishedSeconds: null | number, locale: string, nowMs = Date.now()): string {
  if (!publishedSeconds) {
    return ''
  }

  const minutes = Math.round((publishedSeconds * 1000 - nowMs) / 60_000)
  const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' })

  if (Math.abs(minutes) < 60) {
    return format.format(minutes, 'minute')
  }

  return Math.abs(minutes) < 60 * 24
    ? format.format(Math.round(minutes / 60), 'hour')
    : format.format(Math.round(minutes / (60 * 24)), 'day')
}

/**
 * Live AI headlines with something to do about each one: ask Czesiek what it
 * means, or keep it in the vault. Filtering by source is client-side over the
 * one cached fetch, so switching chips costs nothing.
 */
export function JarvisNewsLiveCard({ connected }: { connected: boolean }) {
  const { locale, t } = useI18n()
  const copy = locale === 'pl' ? COPY.pl : COPY.en
  const state = t.jarvisShell.home.news
  const [source, setSource] = useState<null | string>(null)
  const [expanded, setExpanded] = useState(false)
  const [saving, setSaving] = useState<null | string>(null)
  const queryClient = useQueryClient()
  const read = useStore($newsRead)
  const muted = useStore($newsMuted)

  const news = useQuery({
    enabled: connected,
    queryFn: () => getAiNews(NEWS_FETCH),
    queryKey: ['jarvis-ai-news', NEWS_FETCH],
    refetchInterval: NEWS_REFRESH_MS,
    staleTime: NEWS_REFRESH_MS
  })

  const all = useMemo(() => withoutMuted(news.data?.items ?? [], muted), [news.data, muted])
  const chips = useMemo(() => topSources(all), [all])
  const filtered = source && chips.includes(source) ? all.filter(item => item.source === source) : all
  const items = expanded ? filtered : filtered.slice(0, NEWS_SHOWN)
  const unread = all.filter(item => !read.includes(item.link))

  const save = async (item: (typeof all)[number]) => {
    setSaving(item.link)

    try {
      const body = `# ${item.title}\n\n${item.summary ? `${item.summary}\n\n` : ''}Źródło: ${item.source}\n${item.link}\n`

      // The link is the identity: the same headline again is "already there",
      // a different one with the same file name gets its own note.
      const made = await createVaultNote(item.title, {
        content: body,
        dedupeKey: item.link,
        externalSource: `${item.source} (${item.link})`,
        folder: NEWS_FOLDER
      })

      notify({
        kind: made.existed ? 'info' : 'success',
        message: made.existed ? copy.savedAlready : copy.saved,
        durationMs: 2000
      })
      void queryClient.invalidateQueries({ queryKey: [VAULT_RAIL_KEY] })
    } catch (error) {
      notifyError(error, copy.save)
    } finally {
      setSaving(null)
    }
  }

  return (
    <RailCard
      action={
        <span className="flex items-center">
          {unread.length > 0 ? (
            <Button
              aria-label={`${copy.markAll} (${unread.length})`}
              onClick={() => markNewsRead(all.map(item => item.link))}
              size="xs"
              title={copy.markAll}
              type="button"
              variant="ghost"
            >
              <Checks />
              {unread.length}
            </Button>
          ) : null}
          <Button
            aria-label={state.refresh}
            disabled={!connected || news.isFetching}
            onClick={() => void news.refetch()}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <RefreshCw className={cn(news.isFetching && 'animate-spin')} />
          </Button>
        </span>
      }
      icon={Zap}
      testId="news"
      title={copy.title}
    >
      {!connected ? (
        <p className="text-xs text-(--ui-text-secondary)">{state.offline}</p>
      ) : news.isPending ? (
        <p className="flex items-center gap-2 text-xs text-(--ui-text-secondary)">
          <Loader2 className="size-3.5 animate-spin" />
          {state.loading}
        </p>
      ) : news.isError ? (
        <p className="text-xs text-(--ui-text-secondary)" role="status">
          {state.error}
        </p>
      ) : all.length === 0 ? (
        <>
          <p className="text-xs text-(--ui-text-secondary)">{state.empty}</p>
          {muted.length > 0 ? (
            <Button className="mt-1" onClick={unmuteAllSources} size="sm" type="button" variant="text">
              {copy.muted(muted.length)}
            </Button>
          ) : null}
        </>
      ) : (
        <>
          {chips.length > 1 ? (
            <div aria-label={copy.sources} className="mb-2 flex flex-wrap gap-1" role="group">
              {[null, ...chips].map(name => (
                <Button
                  aria-pressed={source === name}
                  key={name ?? 'all'}
                  onClick={() => {
                    setSource(name)
                    setExpanded(false)
                  }}
                  size="xs"
                  type="button"
                  variant={source === name ? 'default' : 'secondary'}
                >
                  {name ?? copy.all}
                </Button>
              ))}
            </div>
          ) : null}
          <ul className="grid grid-cols-1 gap-1">
            {items.map((item, index) => (
              <li
                className={cn('group relative transition-opacity', read.includes(item.link) && 'opacity-60')}
                key={item.link}
              >
                <button
                  className="flex min-h-11 w-full items-start gap-3 rounded-lg px-2 py-2 text-left outline-none hover:bg-(--chrome-action-hover) focus-visible:outline focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-(--ui-accent)"
                  onClick={() => {
                    markNewsRead([item.link])
                    void window.hermesDesktop?.openExternal?.(item.link)
                  }}
                  title={item.summary || item.title}
                  type="button"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'mt-1.5 size-2 shrink-0 rounded-full',
                      index === 0 && !source ? 'bg-emerald-400 shadow-[0_0_8px_rgb(52_211_153)]' : 'bg-(--ui-accent)/70'
                    )}
                  />
                  <span className="min-w-0 flex-1 pr-12">
                    <span
                      className={cn(
                        'line-clamp-2 text-sm leading-5 text-(--ui-text-primary)',
                        !read.includes(item.link) && 'font-medium'
                      )}
                    >
                      {item.title}
                    </span>
                    <span className="mt-0.5 flex gap-2 text-xs text-(--ui-text-tertiary)">
                      <span className="truncate">{item.source}</span>
                      {item.published ? <span className="shrink-0">{relativeAge(item.published, locale)}</span> : null}
                    </span>
                  </span>
                </button>
                <span className="absolute right-1 top-1.5 flex opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                  <Button
                    aria-label={copy.ask}
                    onClick={() =>
                      requestComposerInsert(copy.askPrompt(item.title, item.link), { mode: 'block', target: 'main' })
                    }
                    size="icon-sm"
                    type="button"
                    variant="ghost"
                  >
                    <Sparkles />
                  </Button>
                  <Button
                    aria-label={copy.mute(item.source)}
                    onClick={() => {
                      setSourceMuted(item.source, true)
                      setSource(null)
                    }}
                    size="icon-sm"
                    title={copy.mute(item.source)}
                    type="button"
                    variant="ghost"
                  >
                    <EyeOff />
                  </Button>
                  <Button
                    aria-label={copy.save}
                    disabled={saving === item.link}
                    onClick={() => void save(item)}
                    size="icon-sm"
                    type="button"
                    variant="ghost"
                  >
                    {saving === item.link ? <Loader2 className="animate-spin" /> : <Bookmark />}
                  </Button>
                </span>
              </li>
            ))}
          </ul>
          <Button
            className="mt-1 w-full"
            onClick={() =>
              requestComposerInsert(
                copy.briefPrompt(
                  (unread.length ? unread : filtered)
                    .slice(0, 6)
                    .map(item => `- ${item.title} (${item.source}) ${item.link}`)
                    .join('\n')
                ),
                { mode: 'block', target: 'main' }
              )
            }
            size="sm"
            type="button"
            variant="secondary"
          >
            <Sparkles />
            {copy.brief}
          </Button>
          {muted.length > 0 ? (
            <Button className="mt-1" onClick={unmuteAllSources} size="sm" type="button" variant="text">
              {copy.muted(muted.length)}
            </Button>
          ) : null}
          {filtered.length > NEWS_SHOWN ? (
            <Button className="mt-1" onClick={() => setExpanded(v => !v)} size="sm" type="button" variant="text">
              {expanded ? copy.less : copy.more(filtered.length - NEWS_SHOWN)}
            </Button>
          ) : null}
        </>
      )}
    </RailCard>
  )
}
