import { useStore } from '@nanostores/react'
import { type ReactNode, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'

import { NEW_CHAT_ROUTE } from '@/app/routes'
import { MarkdownTextContent } from '@/components/assistant-ui/markdown-text'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useI18n } from '@/i18n'
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Lightbulb,
  Maximize,
  MoreHorizontal,
  Newspaper,
  PanelLeftIcon,
  PanelRightIcon
} from '@/lib/icons'
import { cn } from '@/lib/utils'
import { requestBriefing } from '@/store/composer'
import { $sidebarOpen, toggleSidebarOpen } from '@/store/layout'
import { $petOverlayActive, popOutDesktopOrb } from '@/store/pet-overlay'

import { JarvisCore } from './core'
import { desktopOrbCopy } from './desktop-orb-copy'
import { $desktopOrbMode } from './desktop-orb-state'
import { $jarvisFocusMode, $jarvisRailVisible, setJarvisFocusMode } from './focus-mode'
import { JarvisInsightsPanel } from './insights-panel'
import { deriveJarvisMetrics } from './metrics'
import type { JarvisNewsItem } from './news'
import type { JarvisInsightsView } from './panel-copy'
import { $railHidden, setRailHidden } from './rail-layout'
import { JarvisStatusStrip } from './status-strip'
import { JarvisTipsLauncher } from './tips'
import type { JarvisUiState } from './types'
import { VoiceWave } from './voice-wave'

type DashboardLayout = 'desktop' | 'mobile' | 'tablet'

/** Work in flight — nothing may open itself over it. */
const BUSY_PHASES = new Set<JarvisUiState['task']['phase']>(['approval', 'cancelling', 'planning', 'running'])

export interface JarvisDashboardProps {
  children: ReactNode
  className?: string
  connected: boolean
  /**
   * A fresh draft is showing the home hero, which carries its own orb and
   * greeting — the header drops both so the screen says each thing once.
   */
  home?: boolean
  layout?: DashboardLayout
  /** The digest built from real update status and real session events. */
  news?: readonly JarvisNewsItem[]
  onOpenUpdate?: (target: 'backend' | 'client') => void
  profileDisplayName?: string
  /** Cards stacked above the insights panel in the desktop rail. */
  rail?: ReactNode
  /** Controls that sit beside the rail's hide button (e.g. the layout menu). */
  railActions?: ReactNode
  /** The two model pickers, top right of the conversation. */
  switcher?: ReactNode
  state: JarvisUiState
  voiceControls?: ReactNode
}

function greeting(
  copy: ReturnType<typeof useI18n>['t']['jarvisShell']['dashboard'],
  profileDisplayName?: string
): string {
  const name = profileDisplayName?.trim()

  return name ? copy.emptyGreeting(name) : copy.emptyGreeting()
}

function dashboardLayoutForViewport(): DashboardLayout {
  if (window.matchMedia?.('(max-width: 767px)').matches) {
    return 'mobile'
  }

  if (window.matchMedia?.('(max-width: 1149px)').matches) {
    return 'tablet'
  }

  return 'desktop'
}

function useDashboardLayout(override: DashboardLayout | undefined): DashboardLayout {
  const [layout, setLayout] = useState<DashboardLayout>(() => override ?? dashboardLayoutForViewport())

  useEffect(() => {
    if (override) {
      setLayout(override)

      return undefined
    }

    const media = [window.matchMedia?.('(max-width: 767px)'), window.matchMedia?.('(max-width: 1149px)')].filter(
      Boolean
    ) as MediaQueryList[]

    const update = () => setLayout(dashboardLayoutForViewport())

    // The override may have just been dropped, so resync before listening.
    update()

    for (const query of media) {
      query.addEventListener?.('change', update)
      query.addListener?.(update)
    }

    return () => {
      for (const query of media) {
        query.removeEventListener?.('change', update)
        query.removeListener?.(update)
      }
    }
  }, [override])

  return layout
}

/**
 * Home's top bar: today's date with a sun or moon for the part of the day on
 * the left, the tips deck and focus mode on the right.
 */
function HomeTopBar({
  connected,
  openTips,
  switcher
}: {
  connected: boolean
  openTips: () => void
  switcher?: ReactNode
}) {
  const { locale, t } = useI18n()
  const copy = t.jarvisShell.home
  const briefingCopy = t.jarvisShell.briefing
  const focus = useStore($jarvisFocusMode)
  const [menuOpen, setMenuOpen] = useState(false)
  const pl = locale === 'pl'
  const sidebarOpen = useStore($sidebarOpen)
  const railHidden = useStore($railHidden)
  const orbActive = useStore($petOverlayActive)
  const orbMode = useStore($desktopOrbMode)
  const orbShown = orbActive && orbMode
  const petOverlay = window.hermesDesktop?.petOverlay

  // Everything that used to crowd the top of the screen lives behind one quiet button.
  const items: { icon: ReactNode; label: string; onSelect: () => void; pressed?: boolean; disabled?: boolean }[] = [
    {
      disabled: !connected,
      icon: <Newspaper />,
      label: briefingCopy.button,
      onSelect: () => requestBriefing({ speak: true })
    },
    { icon: <Lightbulb />, label: pl ? 'Podpowiedzi' : 'Tips', onSelect: openTips },
    ...(petOverlay
      ? [
          {
            icon: <span aria-hidden="true" className="jarvis-mini-orb" />,
            label: orbShown ? (pl ? 'Wróć do kuli' : 'Return to orb') : desktopOrbCopy[pl ? 'pl' : 'en'].show,
            onSelect: () =>
              orbShown
                ? petOverlay.control({ type: 'toggle-app' })
                : popOutDesktopOrb(() => petOverlay.control({ type: 'toggle-app' })),
            pressed: orbShown
          }
        ]
      : []),
    {
      icon: <Maximize />,
      label: focus ? copy.focusModeExit : copy.focusMode,
      onSelect: () => setJarvisFocusMode(!focus),
      pressed: focus
    }
  ]

  return (
    <div className="flex w-full items-center gap-3">
      <div className="flex min-w-0 items-center gap-2 text-sm font-medium text-(--ui-text-secondary)">
        <Button
          aria-label={pl ? 'Pokaż lub ukryj lewy panel' : 'Show or hide the left panel'}
          aria-pressed={sidebarOpen}
          className="jarvis-glass jarvis-glass-hover size-10 min-h-10 min-w-10 rounded-full"
          onClick={toggleSidebarOpen}
          size="icon"
          title={pl ? 'Lewy panel' : 'Left panel'}
          type="button"
          variant="secondary"
        >
          <PanelLeftIcon />
        </Button>
        <LayoutDashboard className="size-4 shrink-0 text-(--ui-accent)" />
        <span className="truncate">Workspace</span>
      </div>
      <div className="ml-auto flex min-w-0 items-center gap-2">
        {switcher}
        <Popover onOpenChange={setMenuOpen} open={menuOpen}>
          <PopoverTrigger asChild>
            <Button
              aria-label={pl ? 'Więcej' : 'More'}
              className="jarvis-glass jarvis-glass-hover size-10 min-h-10 min-w-10 rounded-full"
              size="icon"
              title={pl ? 'Więcej' : 'More'}
              type="button"
              variant="secondary"
            >
              <MoreHorizontal />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="jarvis-menu grid w-56 gap-0.5 p-1.5">
            {items.map(item => (
              <button
                aria-pressed={item.pressed}
                className="jarvis-menu-item flex min-h-10 w-full items-center gap-2.5 rounded-xl px-2.5 text-left text-sm outline-none disabled:opacity-50"
                disabled={item.disabled}
                key={item.label}
                onClick={() => {
                  setMenuOpen(false)
                  item.onSelect()
                }}
                type="button"
              >
                <span className="text-(--ui-accent) [&_svg]:size-4">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </PopoverContent>
        </Popover>
        <Button
          aria-label={pl ? 'Pokaż lub ukryj prawy panel' : 'Show or hide the right panel'}
          aria-pressed={!railHidden}
          className="jarvis-glass jarvis-glass-hover size-10 min-h-10 min-w-10 rounded-full"
          onClick={() => setRailHidden(!railHidden)}
          size="icon"
          title={pl ? 'Prawy panel' : 'Right panel'}
          type="button"
          variant="secondary"
        >
          <PanelRightIcon />
        </Button>
      </div>
    </div>
  )
}

function ResultHeader({
  copy,
  profileDisplayName,
  state
}: {
  copy: ReturnType<typeof useI18n>['t']['jarvisShell']['dashboard']
  profileDisplayName?: string
  state: JarvisUiState
}) {
  const title = state.result?.trim()

  return (
    <header className="shrink-0 px-4 py-4 md:px-5">
      {title ? (
        // The result is the headline. Its "done" state is already on the
        // status strip above — repeating it here would say the same thing
        // twice on one screen.
        //
        // The gateway hands this field the WHOLE answer (`message.complete`
        // → `task.verified`, see use-message-stream/gateway-event/jarvis.ts),
        // so a bare `<h1 className="text-xl …">{title}</h1>` printed the raw
        // markdown source (`**bold**`, `|---|` tables) at display size, with
        // no panel, straight over the wallpaper behind the orb — the wall of
        // text reported in Live mode. It renders as rich text on the reader
        // pane instead: `[data-jarvis-result-pane]` (styles.css) gives it a
        // near-opaque glass fill at conversation scale, and the height cap
        // keeps the orb owning the surface.
        <div aria-level={1} className="jarvis-result-pane" data-jarvis-result-pane="" role="heading">
          <MarkdownTextContent isRunning={false} previewOnly text={title} />
        </div>
      ) : (
        <p className="text-sm font-medium text-(--ui-text-secondary)">{greeting(copy, profileDisplayName)}</p>
      )}
    </header>
  )
}

export function JarvisDashboard({
  children,
  className,
  connected,
  home = false,
  layout: layoutOverride,
  news = [],
  onOpenUpdate,
  profileDisplayName,
  rail,
  railActions,
  state,
  switcher,
  voiceControls
}: JarvisDashboardProps) {
  const { locale, t } = useI18n()
  const navigate = useNavigate()
  const copy = t.jarvisShell.dashboard
  const layout = useDashboardLayout(layoutOverride)
  const focus = useStore($jarvisFocusMode)
  const railCollapsed = useStore($railHidden)
  const showRail = layout === 'desktop' && !focus && !railCollapsed
  const [activityOpen, setActivityOpen] = useState(layout === 'desktop')
  const [view, setView] = useState<JarvisInsightsView>('activity')
  // The rail (desktop home cards) leaves the conversation column too narrow
  // for the full-size status orb beside the status pills.
  const compactCore = layout === 'mobile' && !BUSY_PHASES.has(state.task.phase)
  const activityPanelId = useId()
  const activityTitleId = useId()
  const activityToggleRef = useRef<HTMLButtonElement>(null)
  const activityCloseRef = useRef<HTMLButtonElement>(null)

  // Derived, not stored: the activity list is the single source of truth, so
  // the charts can never disagree with the log above them.
  const metrics = useMemo(() => deriveJarvisMetrics(state.activity), [state.activity])
  const attention = news.filter(item => item.tone === 'warn').length
  const busy = BUSY_PHASES.has(state.task.phase)
  const voiceActive = state.voice === 'listening' || state.voice === 'speaking'

  useEffect(() => {
    setActivityOpen(layout === 'desktop')
  }, [layout])

  // Tells the home hero whether quick access already has a place in the rail.
  const railCards = showRail && Boolean(rail)

  useEffect(() => {
    $jarvisRailVisible.set(railCards)

    return () => $jarvisRailVisible.set(false)
  }, [railCards])

  // On home the deck opens from the "more" menu, so its own trigger renders nothing and hands us the opener.
  const openTipsRef = useRef<() => void>(() => undefined)

  const tipsLauncher = (
    <JarvisTipsLauncher
      busy={busy}
      hasHistory={state.activity.length > 0}
      trigger={
        home
          ? ({ onClick }) => {
              openTipsRef.current = onClick

              return null
            }
          : undefined
      }
    />
  )

  const conversation = (
    <main
      aria-label={copy.conversationLabel}
      className="jarvis-conversation relative isolate flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
      data-home={home ? 'true' : undefined}
    >
      {layout === 'desktop' && !focus && railCollapsed && (
        <Button
          aria-label={t.jarvisShell.home.showRail}
          className="absolute right-4 top-16 z-10 jarvis-glass jarvis-glass-hover"
          onClick={() => setRailHidden(false)}
          size="icon"
          title={t.jarvisShell.home.showRail}
          type="button"
          variant="secondary"
        >
          <ChevronLeft />
        </Button>
      )}
      {/* Theme-aware space backdrop shared by home and conversation. Decoration only. */}
      <span aria-hidden="true" className="jarvis-space" />
      {/* Off home, the two quiet exits live in the corner instead of crowding
          the orb: back to the dashboard, and the tips deck ("and now what?"). */}
      {home ? null : (
        <div className="absolute left-3 top-3 z-10 flex items-center gap-1">
          <Button
            className="text-(--ui-text-secondary)"
            onClick={() => navigate(NEW_CHAT_ROUTE)}
            size="sm"
            type="button"
            variant="ghost"
          >
            <ChevronLeft />
            {locale === 'pl' ? 'Na pulpit' : 'To dashboard'}
          </Button>
          {tipsLauncher}
        </div>
      )}
      {home || !switcher ? null : <div className="absolute right-3 top-3 z-10">{switcher}</div>}
      {/* Balanced, centred header: the orb in the middle of the conversation
          and its status beneath it. The orb stays compact while you read and
          grows — smoothly, see core.css — while you talk with Jarvis. */}
      <div className="flex shrink-0 flex-col items-center gap-3 px-4 pt-4 md:px-5">
        {home ? null : (
          <JarvisCore compact={compactCore && !voiceActive} live taskPhase={state.task.phase} voice={state.voice} />
        )}
        {home ? null : <VoiceWave active={voiceActive} />}
        {home ? (
          <>
            <HomeTopBar connected={connected} openTips={() => openTipsRef.current()} switcher={switcher} />
            {tipsLauncher}
          </>
        ) : null}
        {/* Home carries no status pills: the orb and its ring already say what is happening, and the
            icon-only pills above the voice dock read as stray buttons. */}
        {home ? null : (
          <div className="flex flex-wrap items-center justify-center gap-2">
            <JarvisStatusStrip
              className="justify-center"
              compact
              connected={connected}
              copy={copy.status}
              state={state}
            />
          </div>
        )}
      </div>
      {/* In a conversation the controls sit under the orb; on home they sit at the bottom, out of the orb's way. */}
      {voiceControls && !home ? (
        <div className="mx-auto w-full max-w-2xl shrink-0 px-4 pt-3 md:px-5">{voiceControls}</div>
      ) : null}
      {home ? null : <ResultHeader copy={copy} profileDisplayName={profileDisplayName} state={state} />}
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      {voiceControls && home && (busy || state.voice !== 'idle') ? (
        <div className="mx-auto w-full max-w-2xl shrink-0 px-4 pb-5 pt-2 md:px-5" data-testid="jarvis-voice-bottom">
          {voiceControls}
        </div>
      ) : null}
    </main>
  )

  useEffect(() => {
    if (layout === 'desktop' || !activityOpen) {
      return undefined
    }

    activityCloseRef.current?.focus()

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return
      }

      event.preventDefault()
      setActivityOpen(false)
      activityToggleRef.current?.focus()
    }

    document.addEventListener('keydown', closeOnEscape)

    return () => {
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [activityOpen, layout])

  const closeActivity = () => {
    setActivityOpen(false)
    activityToggleRef.current?.focus()
  }

  const insightsPanel = (
    <JarvisInsightsPanel
      className={cn(
        layout === 'desktop' && (rail ? 'min-h-[22rem] shrink-0 rounded-2xl border-0!' : 'w-80'),
        layout === 'tablet' && 'absolute inset-y-4 right-4 z-20 w-80 rounded-md',
        layout === 'mobile' && 'absolute inset-x-3 bottom-16 z-20 max-h-[60vh] rounded-md'
      )}
      closeButtonRef={activityCloseRef}
      copy={{
        activity: copy.activity,
        news: copy.news,
        stats: copy.stats,
        tabs: copy.insightTabs,
        viewsLabel: copy.insightViewsLabel
      }}
      events={state.activity}
      id={activityPanelId}
      labelledBy={activityTitleId}
      metrics={metrics}
      news={news}
      onClose={layout === 'desktop' ? undefined : closeActivity}
      onOpenUpdate={onOpenUpdate}
      onViewChange={setView}
      surface={layout === 'desktop' ? 'panel' : layout === 'tablet' ? 'drawer' : 'bottom-sheet'}
      view={view}
    />
  )

  return (
    <section
      className={cn(
        'relative flex h-full min-h-0 min-w-0 overflow-hidden bg-(--ui-chat-surface-background) text-(--ui-text-primary)',
        layout === 'mobile' && 'flex-col',
        className
      )}
      data-jarvis-dashboard=""
      data-layout={layout}
      data-testid="jarvis-dashboard"
    >
      {conversation}
      {showRail &&
        (rail ? (
          // The rail scrolls as one column: the cards first, then the session's
          // own activity — so a long news list never squeezes the log away.
          <div
            className="jarvis-dashboard__rail flex w-80 shrink-0 flex-col gap-3 overflow-y-auto border-l border-(--ui-stroke-tertiary) p-3 backdrop-blur-2xl"
            data-testid="jarvis-rail"
          >
            <div className="flex items-center justify-end gap-2">
              {railActions}
              <Button
                aria-label={t.jarvisShell.home.hideRail}
                className="jarvis-glass jarvis-glass-hover"
                onClick={() => setRailHidden(true)}
                size="icon"
                title={t.jarvisShell.home.hideRail}
                type="button"
                variant="secondary"
              >
                <ChevronRight />
              </Button>
            </div>
            {rail}
            {insightsPanel}
            <p className="mt-auto flex items-center justify-end gap-2 px-1 pt-2 text-xs text-(--ui-text-tertiary)">
              {t.jarvisShell.home.footerMotto}
              <span
                aria-hidden="true"
                className="size-2 rounded-full bg-(--ui-accent) shadow-[0_0_10px_var(--ui-accent)]"
              />
            </p>
          </div>
        ) : (
          <div className="relative flex shrink-0">
            <Button
              aria-label={t.jarvisShell.home.hideRail}
              className="absolute right-3 top-2 z-10"
              onClick={() => setRailHidden(true)}
              size="icon"
              type="button"
              variant="ghost"
            >
              <ChevronRight />
            </Button>
            {insightsPanel}
          </div>
        ))}
      {layout !== 'desktop' && (
        <Button
          aria-controls={activityPanelId}
          aria-expanded={activityOpen}
          aria-label={copy.showActivity}
          className="absolute right-4 top-4 z-20 min-h-11"
          data-jarvis-activity-toggle
          onClick={() => setActivityOpen(open => !open)}
          ref={activityToggleRef}
          size="sm"
          type="button"
          variant="secondary"
        >
          <Activity />
          {copy.showActivity}
          {attention > 0 && (
            <Badge size="xs" variant="warn">
              {attention}
            </Badge>
          )}
        </Button>
      )}
      {layout !== 'desktop' && activityOpen && insightsPanel}
    </section>
  )
}
