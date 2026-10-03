import { useStore } from '@nanostores/react'
import { createRef, type KeyboardEvent, useMemo } from 'react'

import logoUrl from '@/assets/czesiek-logo.png'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useI18n } from '@/i18n'
import {
  Activity,
  Box,
  Brain,
  CheckCircle2,
  ChevronRight,
  Clock,
  LayoutDashboard,
  Link2,
  MessageCircle,
  MoreHorizontal,
  Network,
  Plus,
  Search,
  Settings2,
  Starmap,
  Users,
  Wrench
} from '@/lib/icons'
import { IS_MAC } from '@/lib/keybinds/combo'
import { cn } from '@/lib/utils'
import { openCommandPalette } from '@/store/command-palette'
import { $activeGatewayProfile, $profiles, newSessionInProfile, profileLabel } from '@/store/profile'
import { setSessionPickerOpen } from '@/store/session'

import type { JarvisShellCopy, JarvisShellView } from './i18n'

const PRIMARY = ['jarvis', 'tasks', 'agents', 'connections', 'settings'] as const
const SECONDARY = ['starmap', 'artifacts', 'prompts', 'tools', 'webhooks', 'insights'] as const

const ICONS = {
  jarvis: LayoutDashboard,
  tasks: CheckCircle2,
  agents: Users,
  connections: Network,
  settings: Settings2,
  starmap: Starmap,
  artifacts: Box,
  prompts: MessageCircle,
  memory: Brain,
  tools: Wrench,
  webhooks: Link2,
  insights: Activity
}

const ROW =
  'jarvis-nav-row flex h-11 min-h-11 w-full shrink-0 items-center gap-3 rounded-xl px-3 text-left text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-(--ui-accent)'

interface JarvisNavigationProps {
  activeView: JarvisShellView
  copy: JarvisShellCopy
  onSelect: (view: JarvisShellView) => void
}

/** Primary destinations stay in sight; the complete workspace remains one click away. */
export function JarvisNavigation({ activeView, copy, onSelect }: JarvisNavigationProps) {
  const { locale } = useI18n()
  const pl = locale === 'pl'
  const profile = useStore($activeGatewayProfile)
  const profiles = useStore($profiles)
  const record = profiles.find(row => row.name === profile)
  const rawName = record ? profileLabel(record) : profile || 'default'
  const profileName = rawName === 'default' ? (pl ? 'Profil główny' : 'Main profile') : rawName
  const refs = useMemo(() => PRIMARY.map(() => createRef<HTMLButtonElement>()), [])
  const moreActive = activeView === 'memory' || (SECONDARY as readonly string[]).includes(activeView)

  const navigateKeys = (index: number) => (event: KeyboardEvent<HTMLButtonElement>) => {
    const targets: Record<string, number> = {
      ArrowDown: (index + 1) % PRIMARY.length,
      ArrowRight: (index + 1) % PRIMARY.length,
      ArrowUp: (index - 1 + PRIMARY.length) % PRIMARY.length,
      ArrowLeft: (index - 1 + PRIMARY.length) % PRIMARY.length,
      Home: 0,
      End: PRIMARY.length - 1
    }

    if (targets[event.key] !== undefined) {
      event.preventDefault()
      refs[targets[event.key]].current?.focus()
    }
  }

  const destination = (view: (typeof PRIMARY)[number]) => {
    const Icon = ICONS[view]
    const index = PRIMARY.indexOf(view)
    const active = activeView === view || (view === 'connections' && activeView === 'messaging')

    return (
      <button
        aria-current={active ? 'page' : undefined}
        className={cn(ROW, active && 'jarvis-nav-active')}
        data-jarvis-nav-view={view}
        key={view}
        onClick={() => onSelect(view)}
        onKeyDown={navigateKeys(index)}
        ref={refs[index]}
        type="button"
      >
        <Icon className="size-5 shrink-0" />
        <span className="truncate">{copy.views[view]}</span>
      </button>
    )
  }

  return (
    <aside
      className="jarvis-navigation jarvis-glass-strong grid min-h-0 w-full shrink-0 grid-cols-[1fr_auto] gap-2 p-2 md:m-2 md:mr-0 md:flex md:h-[calc(100%-1rem)] md:w-56 md:flex-col md:gap-3 md:rounded-3xl md:p-3"
      data-jarvis-nav-rail=""
    >
      <div className="flex min-w-0 items-center gap-3 px-1 py-1">
        <img alt="" className="size-11 shrink-0 object-contain" src={logoUrl} />
        <div className="min-w-0">
          <div className="jarvis-wordmark text-base font-semibold">{copy.productName}</div>
          <div className="jarvis-brand-signature">AI Evolution Polska</div>
        </div>
      </div>
      <button
        aria-label={copy.home.nav.search}
        className={cn(ROW, 'jarvis-well hidden text-(--ui-text-secondary) md:flex')}
        onClick={openCommandPalette}
        type="button"
      >
        <Search className="size-4" />
        <span className="flex-1">{copy.home.nav.search}</span>
        <kbd className="hidden text-xs md:block">{IS_MAC ? '⌘ K' : 'Ctrl K'}</kbd>
      </button>
      <button
        aria-label={pl ? 'Nowa rozmowa' : 'New conversation'}
        className={cn(ROW, 'jarvis-new-conversation')}
        onClick={() => {
          onSelect('jarvis')
          newSessionInProfile($activeGatewayProfile.get() || 'default')
        }}
        type="button"
      >
        <Plus className="size-5" />
        <span className="hidden md:inline">{pl ? 'Nowa rozmowa' : 'New conversation'}</span>
      </button>
      <nav
        aria-label={copy.navigationLabel}
        className="col-span-2 flex min-h-0 min-w-0 gap-1 overflow-x-auto [&>button]:max-md:w-auto md:flex-1 md:flex-col md:overflow-x-hidden md:overflow-y-auto"
        data-jarvis-nav=""
      >
        {PRIMARY.filter(view => view !== 'settings' && view !== 'connections').map(destination)}
        <button className={ROW} data-jarvis-nav-history="" onClick={() => setSessionPickerOpen(true)} type="button">
          <Clock className="size-5" />
          {pl ? 'Rozmowy' : 'Conversations'}
        </button>
        {destination('connections')}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              aria-label={pl ? 'Więcej funkcji' : 'More features'}
              className={cn(ROW, moreActive && 'jarvis-nav-active')}
              type="button"
            >
              <MoreHorizontal className="size-5" />
              {pl ? 'Więcej' : 'More'}
              <ChevronRight className="ml-auto size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="jarvis-menu w-64 p-1.5" side="right">
            {SECONDARY.map(view => {
              const Icon = ICONS[view]

              return (
                <DropdownMenuItem
                  className="min-h-11 gap-3 rounded-xl text-sm"
                  data-jarvis-nav-view={view}
                  key={view}
                  onSelect={() => onSelect(view)}
                >
                  <Icon className="size-5" />
                  {view === 'starmap'
                    ? pl
                      ? 'Pamięć i mapa wiedzy'
                      : 'Memory and knowledge map'
                    : view === 'tools'
                      ? pl
                        ? 'Umiejętności'
                        : 'Skills'
                      : copy.views[view]}
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>
      <div className="col-span-2 flex min-w-0 shrink-0 gap-1 border-t border-(--glass-border) pt-2 md:flex-col">
        {destination('settings')}
        <button
          aria-current={activeView === 'profile' ? 'page' : undefined}
          aria-label={copy.views.profile}
          className={ROW}
          onClick={() => onSelect('profile')}
          type="button"
        >
          <span
            aria-hidden="true"
            className="jarvis-profile-avatar grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold"
          >
            {profileName.slice(0, 1)}
          </span>
          <span className="min-w-0 flex-1 truncate">{profileName}</span>
          <ChevronRight className="size-4 text-(--ui-text-tertiary)" />
        </button>
      </div>
    </aside>
  )
}
