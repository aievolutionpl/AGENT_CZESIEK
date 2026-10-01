import { describe, expect, it } from 'vitest'

import type { AnalyticsDailyEntry } from '@/types/hermes'

import {
  areaPath,
  comparePeriods,
  formatMetric,
  linePath,
  metricSeries,
  nearestIndex,
  sparkPoints,
  topModel
} from './insights-stats'

const day = (key: string, sessions: number, extra: Partial<AnalyticsDailyEntry> = {}) =>
  ({ day: key, sessions, ...extra }) as AnalyticsDailyEntry

const today = new Date(2026, 8, 25, 12)

describe('metricSeries', () => {
  it('fills missing days with zero and keeps one point per day, oldest first', () => {
    const series = metricSeries([day('2026-09-25', 4), day('2026-09-20', 2)], today, 14, 'sessions')

    expect(series).toHaveLength(14)
    expect(series.at(-1)).toBe(4)
    expect(series.at(-6)).toBe(2)
  })

  it('measures tokens as input plus output and prefers the real cost over the estimate', () => {
    const entry = day('2026-09-25', 1, { actual_cost: 0, estimated_cost: 0.5, input_tokens: 100, output_tokens: 20 })

    expect(metricSeries([entry], today, 1, 'tokens')).toEqual([120])
    expect(metricSeries([entry], today, 1, 'cost')).toEqual([0.5])
    expect(metricSeries([{ ...entry, actual_cost: 0.3 }], today, 1, 'cost')).toEqual([0.3])
  })
})

describe('comparePeriods', () => {
  it('compares equal windows, for any window length', () => {
    // 7 days: the old half-split compared 4 days with 3; now it is 7 against the 7 before.
    const daily = [day('2026-09-24', 6), day('2026-09-15', 3)]
    const result = comparePeriods(daily, today, 7, 'sessions')

    expect(result.total).toBe(6)
    expect(result.previousTotal).toBe(3)
    expect(result.changePct).toBe(100)
  })

  it('says nothing about change when there was nothing before', () => {
    expect(comparePeriods([day('2026-09-24', 4)], today, 7, 'sessions').changePct).toBeNull()
  })
})

describe('chart geometry', () => {
  it('spans the whole width and stays inside the box', () => {
    const points = sparkPoints([0, 3, 1, 5], 240, 64)

    const numbers = linePath(points)
      .match(/-?\d+(\.\d+)?/g)!
      .map(Number)

    const xs = numbers.filter((_, index) => index % 2 === 0)
    const ys = numbers.filter((_, index) => index % 2 === 1)

    expect(Math.min(...xs)).toBe(0)
    expect(Math.max(...xs)).toBe(240)
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...ys)).toBeLessThanOrEqual(64)
    expect(areaPath(points, 64).endsWith('Z')).toBe(true)
    expect(linePath(sparkPoints([1], 240, 64))).toBe('')
  })

  it('maps a pointer position to the nearest day and never leaves the series', () => {
    expect(nearestIndex(0, 240, 14)).toBe(0)
    expect(nearestIndex(240, 240, 14)).toBe(13)
    expect(nearestIndex(9999, 240, 14)).toBe(13)
    expect(nearestIndex(-50, 240, 14)).toBe(0)
    expect(nearestIndex(10, 0, 14)).toBe(0)
  })
})

describe('labels', () => {
  it('formats compact numbers and money', () => {
    expect(formatMetric(1_250_000, 'tokens', 'en')).toBe('1.3M')
    expect(formatMetric(0.4, 'cost', 'en')).toBe('$0.40')
  })

  it('names the model with the most calls and its share', () => {
    const models = [
      { api_calls: 30, model: 'a/small' },
      { api_calls: 70, model: 'b/big' }
    ] as never

    expect(topModel(models)).toEqual({ model: 'b/big', share: 70 })
    expect(topModel([])).toBeNull()
  })
})
