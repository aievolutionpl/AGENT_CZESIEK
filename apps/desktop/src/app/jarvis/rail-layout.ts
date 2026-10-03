import { atom } from 'nanostores'

import { persistString, storedString } from '@/lib/storage'

/** The rail's cards in the order they ship; also the ids `RailCard` folds by. */
export const RAIL_CARD_IDS = [
  'start',
  'memory',
  'connect',
  'quick-access',
  'news',
  'insights',
  'model',
  'agents'
] as const

export type RailCardId = (typeof RAIL_CARD_IDS)[number]

export interface RailLayout {
  /** Cards the user switched off; they are not mounted, so they fetch nothing. */
  hidden: RailCardId[]
  /** Every card, top to bottom, hidden ones included so they return where they were. */
  order: RailCardId[]
}

const KEY = 'czesiek:rail-layout:v1'

const isCardId = (value: unknown): value is RailCardId =>
  typeof value === 'string' && (RAIL_CARD_IDS as readonly string[]).includes(value)

/**
 * A saved layout made safe for this build: unknown ids and duplicates dropped, and a card the saved
 * layout has never seen (added by an update) slotted in after the card that precedes it by default,
 * so an update neither loses a card nor dumps it at the bottom.
 */
export function normalizeRailLayout(raw: unknown): RailLayout {
  const input = raw && typeof raw === 'object' ? (raw as Partial<Record<keyof RailLayout, unknown>>) : {}
  const saved = Array.isArray(input.order) ? input.order.filter(isCardId) : []
  const order = [...new Set(saved)]

  RAIL_CARD_IDS.forEach((id, index) => {
    if (order.includes(id)) {
      return
    }

    const before = RAIL_CARD_IDS.slice(0, index)
      .reverse()
      .find(known => order.includes(known))

    order.splice(before ? order.indexOf(before) + 1 : 0, 0, id)
  })

  const hidden = Array.isArray(input.hidden) ? [...new Set(input.hidden.filter(isCardId))] : []

  return { hidden, order }
}

/**
 * The full order after the visible cards were rearranged. Hidden cards keep their slots; the visible
 * ones are dealt into the remaining slots in their new order.
 */
export function applyVisibleOrder(layout: RailLayout, visible: readonly RailCardId[]): RailCardId[] {
  const pool = [...visible]

  return layout.order.map(id => (layout.hidden.includes(id) ? id : (pool.shift() ?? id)))
}

/** One step up (-1) or down (1) among all cards; the ends stay put. */
export function moveRailCard(order: readonly RailCardId[], id: RailCardId, step: -1 | 1): RailCardId[] {
  const from = order.indexOf(id)
  const to = from + step

  if (from < 0 || to < 0 || to >= order.length) {
    return [...order]
  }

  const next = [...order]

  ;[next[from], next[to]] = [next[to], next[from]]

  return next
}

function read(): RailLayout {
  try {
    return normalizeRailLayout(JSON.parse(storedString(KEY) ?? 'null'))
  } catch {
    return normalizeRailLayout(null)
  }
}

/** Which cards the rail shows and in what order. Global to the window: it is a layout preference. */
export const $railLayout = atom<RailLayout>(read())

function commit(next: RailLayout): void {
  $railLayout.set(next)
  persistString(KEY, JSON.stringify(next))
}

export function setRailOrder(order: readonly RailCardId[]): void {
  commit(normalizeRailLayout({ hidden: $railLayout.get().hidden, order }))
}

export function setRailVisibleOrder(visible: readonly RailCardId[]): void {
  setRailOrder(applyVisibleOrder($railLayout.get(), visible))
}

export function setRailCardHidden(id: RailCardId, hidden: boolean): void {
  const current = $railLayout.get()
  const rest = current.hidden.filter(known => known !== id)

  commit({ ...current, hidden: hidden ? [...rest, id] : rest })
}

export function resetRailLayout(): void {
  commit(normalizeRailLayout(null))
}

const HIDDEN_KEY = 'czesiek:rail-hidden:v1'

/** Whether the user folded the whole rail away. Remembered, so the layout they chose is the one they return to. */
export const $railHidden = atom<boolean>(storedString(HIDDEN_KEY) !== '0')

export type WorkspacePanelView = 'tasks' | 'memory'
const VIEW_KEY = 'czesiek:workspace-panel:v1'
export const $workspacePanelView = atom<WorkspacePanelView>(storedString(VIEW_KEY) === 'memory' ? 'memory' : 'tasks')

export function openWorkspacePanel(view: WorkspacePanelView): void {
  $workspacePanelView.set(view)
  persistString(VIEW_KEY, view)
  setRailHidden(false)
}

export function setRailHidden(hidden: boolean): void {
  $railHidden.set(hidden)
  persistString(HIDDEN_KEY, hidden ? '1' : '0')
}
