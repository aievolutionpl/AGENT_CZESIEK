import { Bell, GitBranch, Layers3, Lightbulb, Mail, MessageCircle, Network, NotebookTabs } from '@/lib/icons'

import type { JarvisConnectionId } from './connections-catalog'

type IconComponent = React.ComponentType<{ className?: string }>

/** One face per connection, shared by the onboarding step and the Połączenia page. */
export const CONNECTION_ICONS: Record<JarvisConnectionId, { icon: IconComponent; tile: string }> = {
  email: { icon: Mail, tile: 'bg-sky-400/15 text-sky-700 dark:text-sky-300 ring-1 ring-inset ring-current/15' },
  github: {
    icon: GitBranch,
    tile: 'bg-zinc-300/15 text-zinc-700 dark:text-zinc-200 ring-1 ring-inset ring-current/15'
  },
  google: {
    icon: Layers3,
    tile: 'bg-emerald-400/15 text-emerald-700 dark:text-emerald-300 ring-1 ring-inset ring-current/15'
  },
  mcp: {
    icon: Network,
    tile: 'bg-fuchsia-400/15 text-fuchsia-700 dark:text-fuchsia-300 ring-1 ring-inset ring-current/15'
  },
  messaging: {
    icon: MessageCircle,
    tile: 'bg-cyan-400/15 text-cyan-700 dark:text-cyan-300 ring-1 ring-inset ring-current/15'
  },
  notion: {
    icon: NotebookTabs,
    tile: 'bg-stone-300/15 text-stone-700 dark:text-stone-200 ring-1 ring-inset ring-current/15'
  },
  phone: { icon: Bell, tile: 'bg-amber-400/15 text-amber-700 dark:text-amber-300 ring-1 ring-inset ring-current/15' },
  smartHome: {
    icon: Lightbulb,
    tile: 'bg-yellow-400/15 text-yellow-700 dark:text-yellow-300 ring-1 ring-inset ring-current/15'
  }
}
