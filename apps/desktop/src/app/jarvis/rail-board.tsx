import {
  type Announcements,
  KeyboardSensor,
  PointerSensor,
  type ScreenReaderInstructions,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useStore } from '@nanostores/react'
import { type HTMLAttributes, type ReactNode, useMemo } from 'react'

import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { useI18n } from '@/i18n'
import { ArrowDown, ArrowUp, RotateCcw, SlidersHorizontal } from '@/lib/icons'
import { reorderCommitHaptic, reorderStepHaptic } from '@/lib/reorder'
import { cn } from '@/lib/utils'

import { ReorderableList, useSortableBindings } from '../chat/sidebar/reorderable-list'

import { RailSlotContext, type RailSlotControls } from './rail-card'
import { RAIL_CARD_COPY } from './rail-copy'
import {
  $railLayout,
  moveRailCard,
  normalizeRailLayout,
  RAIL_CARD_IDS,
  type RailCardId,
  resetRailLayout,
  setRailCardHidden,
  setRailOrder,
  setRailVisibleOrder
} from './rail-layout'

/** Cards differ in height, so they settle with the app's soft rise, not the tab strip's springy overshoot. */
const SETTLE = { duration: 280, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }

const useRailCopy = () => (useI18n().locale === 'pl' ? RAIL_CARD_COPY.pl : RAIL_CARD_COPY.en)

function RailSlot({ children, id }: { children: ReactNode; id: RailCardId }) {
  const { activatorRef, attributes, dragging, listeners, ref, style } = useSortableBindings(id, SETTLE)

  const controls = useMemo<RailSlotControls>(
    () => ({
      dragging,
      grip: { attributes: attributes as HTMLAttributes<HTMLElement>, ref: activatorRef },
      headerListeners: (listeners ?? {}) as HTMLAttributes<HTMLElement>
    }),
    [activatorRef, attributes, dragging, listeners]
  )

  return (
    <div className="jarvis-rail-slot" data-dragging={dragging || undefined} ref={ref} style={style}>
      <RailSlotContext.Provider value={controls}>{children}</RailSlotContext.Provider>
    </div>
  )
}

/**
 * The rail's cards in the user's own order, draggable by their header (Space and the arrows work on
 * the grip). A card switched off is not rendered at all, so it holds no queries or timers. Cards the
 * board is not given are skipped, which keeps it usable with a partial rail.
 */
export function RailBoard({ cards }: { cards: Partial<Record<RailCardId, ReactNode>> }) {
  const copy = useRailCopy()
  const layout = useStore($railLayout)
  const visible = layout.order.filter(id => !layout.hidden.includes(id) && cards[id] !== undefined)

  // A small movement threshold: a tap on the header still folds the card.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const accessibility = useMemo(() => {
    const name = (id: unknown) => copy.cards[String(id) as RailCardId] ?? String(id)
    const place = (id: unknown) => visible.indexOf(String(id) as RailCardId) + 1

    const announcements: Announcements = {
      onDragCancel: ({ active }) => copy.dragCancelled(name(active.id)),
      onDragEnd: ({ active, over }) => copy.dragDropped(name(active.id), place(over?.id ?? active.id), visible.length),
      onDragOver: ({ active, over }) =>
        over ? copy.dragMoved(name(active.id), place(over.id), visible.length) : undefined,
      onDragStart: ({ active }) => copy.dragStart(name(active.id))
    }

    const screenReaderInstructions: ScreenReaderInstructions = { draggable: copy.instructions }

    return { announcements, screenReaderInstructions }
  }, [copy, visible])

  return (
    <ReorderableList
      accessibility={accessibility}
      ids={visible}
      onReorder={ids => {
        reorderCommitHaptic()
        setRailVisibleOrder(ids as RailCardId[])
      }}
      sensors={sensors}
    >
      {visible.map(id => (
        <RailSlot id={id} key={id}>
          {cards[id]}
        </RailSlot>
      ))}
    </ReorderableList>
  )
}

/** Show or hide each card, move it without dragging, or put everything back. */
export function RailCustomizeMenu({ className }: { className?: string }) {
  const copy = useRailCopy()
  const layout = useStore($railLayout)
  const isDefault = JSON.stringify(layout) === JSON.stringify(normalizeRailLayout(null))

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          aria-label={copy.customize}
          className={cn('jarvis-glass jarvis-glass-hover', className)}
          size="icon"
          title={copy.customize}
          type="button"
          variant="secondary"
        >
          <SlidersHorizontal />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3" data-testid="jarvis-rail-customize">
        <p className="mb-2 text-sm font-semibold text-(--ui-text-primary)">{copy.customize}</p>
        <p className="mb-3 text-xs text-(--ui-text-tertiary)">{copy.customizeHint}</p>
        <ul className="grid gap-1">
          {layout.order.map((id, index) => {
            const name = copy.cards[id]
            const shown = !layout.hidden.includes(id)

            return (
              <li className="flex min-h-10 items-center gap-2 rounded-lg px-1" key={id}>
                <Switch
                  aria-label={copy.show(name)}
                  checked={shown}
                  onCheckedChange={checked => setRailCardHidden(id, !checked)}
                  size="xs"
                />
                <span className={cn('min-w-0 flex-1 truncate text-sm', !shown && 'text-(--ui-text-tertiary)')}>
                  {name}
                </span>
                <Button
                  aria-label={copy.up(name)}
                  disabled={index === 0}
                  onClick={() => {
                    reorderStepHaptic()
                    setRailOrder(moveRailCard(layout.order, id, -1))
                  }}
                  size="icon-xs"
                  type="button"
                  variant="ghost"
                >
                  <ArrowUp />
                </Button>
                <Button
                  aria-label={copy.down(name)}
                  disabled={index === RAIL_CARD_IDS.length - 1}
                  onClick={() => {
                    reorderStepHaptic()
                    setRailOrder(moveRailCard(layout.order, id, 1))
                  }}
                  size="icon-xs"
                  type="button"
                  variant="ghost"
                >
                  <ArrowDown />
                </Button>
              </li>
            )
          })}
        </ul>
        <Button
          className="mt-2 w-full"
          disabled={isDefault}
          onClick={resetRailLayout}
          size="sm"
          type="button"
          variant="secondary"
        >
          <RotateCcw />
          {copy.reset}
        </Button>
      </PopoverContent>
    </Popover>
  )
}
