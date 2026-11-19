import { useStore } from '@nanostores/react'
import { createContext, type HTMLAttributes, type ReactNode, type Ref, useContext, useEffect, useState } from 'react'

import { useI18n } from '@/i18n'
import { triggerHaptic } from '@/lib/haptics'
import { ChevronDown, GripVertical } from '@/lib/icons'
import { cn } from '@/lib/utils'

import { $railCollapsed, setRailCardCollapsed } from './rail-collapse'
import { RAIL_CARD_COPY } from './rail-copy'

/**
 * What a card needs to be dragged while it sits in the rail board: pointer listeners for the header,
 * and the keyboard-operable grip. Absent outside the board, where a card is just a card.
 */
export interface RailSlotControls {
  dragging: boolean
  /** Keyboard activator (Space to lift, arrows to move); also the pointer handle's focus target. */
  grip: { attributes: HTMLAttributes<HTMLElement>; ref: Ref<HTMLButtonElement> }
  /** Pointer drag starts from anywhere on the header; a small movement threshold keeps clicks clicks. */
  headerListeners: HTMLAttributes<HTMLElement>
}

export const RailSlotContext = createContext<null | RailSlotControls>(null)

/** Long enough to play the fold, short enough that nothing lingers: the CSS transition is 280 ms. */
const FOLD_MS = 300

function reducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Whether a card's content should be mounted: while open, and for the length of the fold after it
 * closes, so the collapse can play before the content goes away (a folded card then holds no timers,
 * queries or polling of its own).
 */
function useFoldPresence(open: boolean): boolean {
  const [lingering, setLingering] = useState(open)

  useEffect(() => {
    if (open) {
      setLingering(true)

      return undefined
    }

    const timer = window.setTimeout(() => setLingering(false), reducedMotion() ? 0 : FOLD_MS)

    return () => window.clearTimeout(timer)
  }, [open])

  return open || lingering
}

export function RailCard({
  action,
  children,
  defaultCollapsed = false,
  icon: Icon,
  title,
  testId
}: {
  action?: ReactNode
  children: ReactNode
  /** Where the card starts until the user folds or opens it. */
  defaultCollapsed?: boolean
  icon: React.ComponentType<{ className?: string }>
  title: string
  testId: string
}) {
  const { locale } = useI18n()
  const headingId = `jarvis-rail-${testId}`
  const folded = useStore($railCollapsed)[testId] ?? defaultCollapsed
  const slot = useContext(RailSlotContext)
  const present = useFoldPresence(!folded)

  return (
    <section
      aria-labelledby={headingId}
      className="jarvis-panel jarvis-rise group/card p-4"
      data-testid={`jarvis-rail-${testId}`}
    >
      <div {...slot?.headerListeners} className="relative flex min-h-9 items-center gap-2">
        {slot ? (
          <button
            {...slot.grip.attributes}
            aria-label={(locale === 'pl' ? RAIL_CARD_COPY.pl : RAIL_CARD_COPY.en).grip(title)}
            className="jarvis-rail-grip"
            data-dragging={slot.dragging || undefined}
            ref={slot.grip.ref}
            type="button"
          >
            <GripVertical className="size-4" />
          </button>
        ) : null}
        <h2 className="min-w-0 flex-1 text-sm font-semibold text-(--ui-text-primary)" id={headingId}>
          <button
            aria-expanded={!folded}
            className="flex w-full min-w-0 items-center gap-2 rounded-md text-left outline-none focus-visible:outline focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ui-accent)"
            onClick={() => {
              triggerHaptic(folded ? 'open' : 'close')
              setRailCardCollapsed(testId, !folded)
            }}
            type="button"
          >
            <span className="jarvis-icon-chip grid size-7 shrink-0 place-items-center rounded-lg">
              <Icon className="size-4" />
            </span>
            <span className="min-w-0 flex-1 truncate">{title}</span>
            <ChevronDown
              className={cn(
                'size-3.5 shrink-0 text-(--ui-text-tertiary) transition-transform duration-300',
                folded && '-rotate-90'
              )}
            />
          </button>
        </h2>
        {action}
      </div>
      {/* The grid-rows trick animates to and from the content's own height, whatever it is. */}
      <div className="jarvis-fold" data-open={!folded} inert={folded}>
        <div className="jarvis-fold__inner">
          <div className="pt-3">{present ? children : null}</div>
        </div>
      </div>
    </section>
  )
}
