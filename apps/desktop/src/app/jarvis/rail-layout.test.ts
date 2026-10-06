// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'

import {
  $railLayout,
  applyRailPreset,
  applyVisibleOrder,
  moveRailCard,
  normalizeRailLayout,
  RAIL_CARD_IDS,
  RAIL_PRESETS,
  railPresetLayout,
  resetRailLayout,
  setRailCardHidden,
  setRailVisibleOrder
} from './rail-layout'

afterEach(() => {
  resetRailLayout()
  window.localStorage.clear()
})

describe('normalizeRailLayout', () => {
  it('always returns every card exactly once, whatever was saved', () => {
    for (const raw of [null, 'junk', {}, { order: 5 }, { order: ['news', 'news', 'ghost', 7] }]) {
      const { order } = normalizeRailLayout(raw)

      expect([...order].sort()).toEqual([...RAIL_CARD_IDS].sort())
    }
  })

  it('keeps the saved order and slots a card it has never seen after its default predecessor', () => {
    // A layout saved before `insights` existed: the newcomer lands after `news`, not at the bottom.
    const saved = RAIL_CARD_IDS.filter(id => id !== 'insights').reverse()
    const { order } = normalizeRailLayout({ order: saved })

    expect(order.indexOf('insights')).toBe(order.indexOf('news') + 1)
    expect(order.filter(id => id !== 'insights')).toEqual(saved)
  })

  it('drops hidden ids it does not know', () => {
    expect(normalizeRailLayout({ hidden: ['news', 'ghost', 'news'] }).hidden).toEqual(['news'])
  })
})

describe('reordering', () => {
  it('deals the rearranged visible cards into their slots and leaves hidden cards where they were', () => {
    const layout = { hidden: ['memory' as const], order: [...RAIL_CARD_IDS] }
    const visible = layout.order.filter(id => id !== 'memory')
    const next = applyVisibleOrder(layout, [...visible].reverse())

    expect(next.indexOf('memory')).toBe(layout.order.indexOf('memory'))
    expect(next.filter(id => id !== 'memory')).toEqual([...visible].reverse())
  })

  it('moves one step at a time and stops at the ends', () => {
    const order = [...RAIL_CARD_IDS]

    expect(moveRailCard(order, 'memory', -1).slice(0, 2)).toEqual(['memory', 'start'])
    expect(moveRailCard(order, 'start', -1)).toEqual(order)
    expect(moveRailCard(order, 'agents', 1)).toEqual(order)
  })
})

describe('the layout store', () => {
  it('persists what the user arranged and survives a reload of the saved value', () => {
    setRailVisibleOrder([...RAIL_CARD_IDS].reverse())
    setRailCardHidden('news', true)

    const saved = JSON.parse(window.localStorage.getItem('czesiek:rail-layout:v1') ?? 'null')

    expect(normalizeRailLayout(saved)).toEqual($railLayout.get())
    expect($railLayout.get().hidden).toEqual(['news'])
    expect($railLayout.get().order[0]).toBe('agents')

    setRailCardHidden('news', false)
    expect($railLayout.get().hidden).toEqual([])
  })

  it('resets to the shipped layout', () => {
    setRailCardHidden('agents', true)
    setRailVisibleOrder([...RAIL_CARD_IDS].reverse())
    resetRailLayout()

    expect($railLayout.get()).toEqual({ hidden: [], order: [...RAIL_CARD_IDS] })
  })
})

describe('rail presets', () => {
  it('show exactly their cards, in order, and hide every other card without dropping it', () => {
    for (const id of Object.keys(RAIL_PRESETS) as (keyof typeof RAIL_PRESETS)[]) {
      const { hidden, order } = railPresetLayout(id)
      const shown = order.filter(card => !hidden.includes(card))

      expect(shown).toEqual(RAIL_PRESETS[id])
      expect([...order].sort()).toEqual([...RAIL_CARD_IDS].sort())
    }
  })

  it('apply to the live layout and survive a reload', () => {
    applyRailPreset('minimal')

    expect(normalizeRailLayout(JSON.parse(window.localStorage.getItem('czesiek:rail-layout:v1') ?? 'null'))).toEqual(
      $railLayout.get()
    )
  })
})
