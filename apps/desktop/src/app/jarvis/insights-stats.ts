import { atom } from 'nanostores'

import { persistString, storedString } from '@/lib/storage'
import type { AnalyticsDailyEntry, AnalyticsModelEntry } from '@/types/hermes'

export type InsightMetric = 'cost' | 'sessions' | 'tokens'
export type InsightDays = 7 | 14 | 30

export const INSIGHT_METRICS: readonly InsightMetric[] = ['sessions', 'tokens', 'cost']
export const INSIGHT_RANGES: readonly InsightDays[] = [7, 14, 30]

export interface InsightPrefs {
  days: InsightDays
  metric: InsightMetric
}

const KEY = 'czesiek:insights-prefs:v1'

function readPrefs(): InsightPrefs {
  try {
    const raw = JSON.parse(storedString(KEY) ?? 'null') as Partial<InsightPrefs> | null

    return {
      days: INSIGHT_RANGES.find(days => days === raw?.days) ?? 14,
      metric: INSIGHT_METRICS.find(metric => metric === raw?.metric) ?? 'sessions'
    }
  } catch {
    return { days: 14, metric: 'sessions' }
  }
}

/** The range and measure the user picked on the stats card; a window-wide display preference. */
export const $insightPrefs = atom<InsightPrefs>(readPrefs())

export function setInsightPrefs(patch: Partial<InsightPrefs>): void {
  const next = { ...$insightPrefs.get(), ...patch }

  $insightPrefs.set(next)
  persistString(KEY, JSON.stringify(next))
}

export function metricValue(entry: AnalyticsDailyEntry, metric: InsightMetric): number {
  if (metric === 'tokens') {
    return (entry.input_tokens || 0) + (entry.output_tokens || 0)
  }

  if (metric === 'cost') {
    return entry.actual_cost || entry.estimated_cost || 0
  }

  return entry.sessions || 0
}

const dayKey = (day: Date) =>
  `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`

/** One value per local day, oldest first, for the `days` days ending `today`; `skip` steps further back. */
export function metricSeries(
  daily: readonly AnalyticsDailyEntry[],
  today: Date,
  days: number,
  metric: InsightMetric,
  skip = 0
): number[] {
  const byDay = new Map(daily.map(entry => [entry.day, metricValue(entry, metric)]))
  const series: number[] = []

  for (let offset = days - 1 + skip; offset >= skip; offset -= 1) {
    series.push(byDay.get(dayKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset))) ?? 0)
  }

  return series
}

export interface PeriodComparison {
  /** This window against the equal window right before it, in percent; null when there was nothing before. */
  changePct: null | number
  previousTotal: number
  series: number[]
  total: number
}

const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0)

export function comparePeriods(
  daily: readonly AnalyticsDailyEntry[],
  today: Date,
  days: number,
  metric: InsightMetric
): PeriodComparison {
  const series = metricSeries(daily, today, days, metric)
  const total = sum(series)
  const previousTotal = sum(metricSeries(daily, today, days, metric, days))

  return {
    changePct: previousTotal > 0 ? Math.round(((total - previousTotal) / previousTotal) * 100) : null,
    previousTotal,
    series,
    total
  }
}

/** Sparkline geometry: one point per value, scaled into a `width` × `height` box with a little headroom. */
export function sparkPoints(series: readonly number[], width: number, height: number): [number, number][] {
  const max = Math.max(1, ...series)
  const step = series.length > 1 ? width / (series.length - 1) : 0

  return series.map((value, index) => [index * step, height - (value / max) * (height - 6) - 3])
}

/** A smooth line through the points. */
export function linePath(points: readonly [number, number][]): string {
  if (points.length < 2) {
    return ''
  }

  return points.reduce((path, [x, y], index) => {
    if (index === 0) {
      return `M${x.toFixed(1)} ${y.toFixed(1)}`
    }

    const [px, py] = points[index - 1]
    const mid = (px + x) / 2

    return `${path} C${mid.toFixed(1)} ${py.toFixed(1)} ${mid.toFixed(1)} ${y.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`
  }, '')
}

/** The same line closed down to the baseline, for the soft fill under it. */
export function areaPath(points: readonly [number, number][], height: number): string {
  const line = linePath(points)

  return line ? `${line} L${points.at(-1)![0].toFixed(1)} ${height} L${points[0][0].toFixed(1)} ${height} Z` : ''
}

/** Which point the pointer is over, for a chart `width` wide with `count` evenly spaced points. */
export function nearestIndex(x: number, width: number, count: number): number {
  if (count < 2 || width <= 0) {
    return 0
  }

  return Math.min(count - 1, Math.max(0, Math.round((x / width) * (count - 1))))
}

export function formatMetric(value: number, metric: InsightMetric, locale: string): string {
  if (metric === 'cost') {
    return new Intl.NumberFormat(locale, {
      currency: 'USD',
      maximumFractionDigits: value < 10 ? 2 : 0,
      style: 'currency'
    }).format(value)
  }

  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1, notation: 'compact' }).format(value)
}

/** The model that did most of the work (by calls), or null with nothing to show. */
export function topModel(models: readonly AnalyticsModelEntry[]): { model: string; share: number } | null {
  const total = sum(models.map(entry => entry.api_calls))
  const best = [...models].sort((a, b) => b.api_calls - a.api_calls)[0]

  return best && total > 0 ? { model: best.model, share: Math.round((best.api_calls / total) * 100) } : null
}
