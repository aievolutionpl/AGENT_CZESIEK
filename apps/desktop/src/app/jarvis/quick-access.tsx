import { useStore } from '@nanostores/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'

import { getPulse, type PulseMatter, sendPulseFeedback } from '@/api/pulse'
import { useI18n } from '@/i18n'
import { Brain, ChevronRight, Clock, FolderOpen, Globe, Mic, Monitor, Sparkles, X } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { $activeGatewayProfile } from '@/store/profile'

import { requestComposerInsert } from '../chat/composer/focus'

import { $jarvisOnboardingCompletedAt, readJarvisOnboardingState } from './onboarding-state'
import { type JarvisPlaybookCategory, selectJarvisPlaybook } from './playbook'
import { pulseSuggestions } from './pulse'
import { RailCard } from './rail-card'

type IconComponent = React.ComponentType<{ className?: string }>

/** Each category keeps one colour, so the list reads by kind before by word. */
const CATEGORY_TILES: Record<JarvisPlaybookCategory, { icon: IconComponent; tile: string }> = {
  automation: { icon: Clock, tile: 'bg-amber-400/15 text-amber-400' },
  computer: { icon: Monitor, tile: 'bg-sky-400/15 text-sky-400' },
  files: { icon: FolderOpen, tile: 'bg-emerald-400/15 text-emerald-400' },
  memory: { icon: Brain, tile: 'bg-fuchsia-400/15 text-fuchsia-400' },
  voice: { icon: Mic, tile: 'bg-violet-400/15 text-violet-400' },
  web: { icon: Globe, tile: 'bg-cyan-400/15 text-cyan-400' }
}

const PULSE_REFRESH_MS = 10 * 60_000

const ROW =
  'group flex min-h-11 w-full items-center gap-3 rounded-2xl px-3 py-2 text-left text-sm text-(--ui-text-primary)'

const FOCUS_RING =
  'outline-none focus-visible:outline focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ui-accent)'

/**
 * The pulse matters for this profile. Taking or dismissing one drops it from
 * the list at once and tells the backend, which decides when it may return.
 */
function useJarvisPulse(connected: boolean) {
  const profile = useStore($activeGatewayProfile)
  const queryClient = useQueryClient()
  const queryKey = ['jarvis-pulse', profile]

  const pulse = useQuery({
    enabled: connected,
    queryFn: getPulse,
    queryKey,
    refetchInterval: PULSE_REFRESH_MS,
    staleTime: PULSE_REFRESH_MS
  })

  const react = (matter: PulseMatter, reaction: 'accept' | 'decline') => {
    // An in-flight refresh must not paint the matter back over the removal.
    void queryClient.cancelQueries({ queryKey })
    queryClient.setQueryData<Awaited<ReturnType<typeof getPulse>>>(queryKey, current =>
      current ? { ...current, matters: current.matters.filter(m => m.id !== matter.id) } : current
    )
    // A lost reaction is not an error to show: the backend's list gets the last word.
    void sendPulseFeedback(matter, reaction).catch(() => queryClient.invalidateQueries({ queryKey }))
  }

  return { matters: pulse.data?.matters ?? [], react }
}

export interface JarvisQuickAccessProps {
  className?: string
  connected: boolean
  /** Visible heading; the list is also named by it. */
  label: string
  limit: number
}

/**
 * Pulse suggestions first (Jarvis noticed something), then capability-gated
 * playbook shortcuts to fill the slots. Taking an entry only fills the
 * composer — the person reads the request before Jarvis gets it.
 */
export function JarvisQuickAccess({ className, connected, label, limit }: JarvisQuickAccessProps) {
  const { t } = useI18n()
  const tips = t.jarvisTips
  const pulseCopy = t.jarvisShell.pulse
  // Setup finishing while this is mounted must widen the deck immediately.
  const completedAt = useStore($jarvisOnboardingCompletedAt)
  const pulse = useJarvisPulse(connected)
  const suggestions = pulseSuggestions(pulse.matters, pulseCopy).slice(0, limit)

  const shortcuts = useMemo(() => {
    const computerMode = readJarvisOnboardingState()?.selections?.computerMode ?? null

    return selectJarvisPlaybook({ computerMode, hasHistory: false }, { limit })
    // `completedAt` is a cache key: a bump means the stored selections changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedAt, limit])

  const fillers = shortcuts.slice(0, Math.max(0, limit - suggestions.length))

  return (
    // Actions, not destinations: a group, so the shell's rail stays the only navigation.
    <div aria-label={label} className={cn('flex w-full flex-col gap-2', className)} role="group">
      {suggestions.map(suggestion => (
        <div
          className="jarvis-glass jarvis-glass-hover jarvis-nav-active flex min-h-11 items-center rounded-2xl text-sm text-(--ui-text-primary)"
          data-pulse-kind={suggestion.matter.kind}
          key={suggestion.matter.id}
        >
          <button
            className={cn('flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2 text-left', FOCUS_RING)}
            onClick={() => {
              pulse.react(suggestion.matter, 'accept')
              requestComposerInsert(suggestion.prompt, { mode: 'block', target: 'main' })
            }}
            title={`${pulseCopy.label}: ${suggestion.title} — ${suggestion.detail}`}
            type="button"
          >
            <span className="relative grid size-8 shrink-0 place-items-center rounded-lg bg-(--ui-accent)/15 text-(--ui-accent)">
              <Sparkles className="size-4" />
              <span
                aria-hidden="true"
                className="absolute -right-0.5 -top-0.5 size-2 animate-pulse rounded-full bg-(--ui-accent)"
              />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-medium">{suggestion.title}</span>
              <span className="block truncate text-xs text-(--ui-text-secondary)">{suggestion.detail}</span>
            </span>
          </button>
          <button
            aria-label={`${pulseCopy.dismiss}: ${suggestion.title}`}
            className={cn(
              'mr-1.5 grid size-8 shrink-0 place-items-center rounded-lg text-(--ui-text-tertiary) transition-colors hover:bg-(--ui-bg-secondary) hover:text-(--ui-text-primary)',
              FOCUS_RING
            )}
            onClick={() => pulse.react(suggestion.matter, 'decline')}
            title={pulseCopy.dismissHint}
            type="button"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
      {fillers.map(entry => {
        const { icon: Icon, tile } = CATEGORY_TILES[entry.category]
        const entryCopy = tips.entries[entry.id]

        return (
          <button
            className={cn(ROW, 'jarvis-glass jarvis-glass-hover', FOCUS_RING)}
            key={entry.id}
            onClick={() => requestComposerInsert(entryCopy.prompt, { mode: 'block', target: 'main' })}
            title={`${entryCopy.title} — ${entryCopy.detail}`}
            type="button"
          >
            <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg', tile)}>
              <Icon className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{entryCopy.title}</span>
              <span className="block truncate text-xs text-(--ui-text-secondary)">{entryCopy.detail}</span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-(--ui-text-tertiary) transition-transform group-hover:translate-x-0.5" />
          </button>
        )
      })}
    </div>
  )
}

/** The design's rail shows four entries. */
const RAIL_QUICK_ACCESS = 4

/** "Szybki dostęp" in the dashboard rail. */
export function JarvisQuickAccessCard({ connected }: { connected: boolean }) {
  const { t } = useI18n()
  const label = t.jarvisShell.home.quickAccess

  return (
    <RailCard icon={Sparkles} testId="quick-access" title={label}>
      <JarvisQuickAccess connected={connected} label={label} limit={RAIL_QUICK_ACCESS} />
    </RailCard>
  )
}
