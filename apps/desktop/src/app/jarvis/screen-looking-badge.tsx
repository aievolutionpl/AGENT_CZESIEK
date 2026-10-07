import { useStore } from '@nanostores/react'

import { useI18n } from '@/i18n'
import { Eye } from '@/lib/icons'
import { $screenLooking } from '@/store/screen-looking'

const COPY = {
  en: 'Czesiek is looking at your screen',
  pl: 'Czesiek patrzy na ekran'
} as const

/** The privacy cue for a screen look: shown only while it happens, and announced to screen readers. */
export function ScreenLookingBadge() {
  const looking = useStore($screenLooking)
  const { locale } = useI18n()

  if (!looking) {
    return null
  }

  return (
    <p
      className="jarvis-glass flex items-center gap-2 rounded-full px-3 py-1 text-xs text-(--ui-text-secondary)"
      data-testid="jarvis-screen-looking"
      role="status"
    >
      <Eye className="size-3.5 text-(--ui-accent)" />
      {locale === 'pl' ? COPY.pl : COPY.en}
    </p>
  )
}
