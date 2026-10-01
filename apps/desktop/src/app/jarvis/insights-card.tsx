import { useStore } from '@nanostores/react'
import { useQuery } from '@tanstack/react-query'
import { type KeyboardEvent, type PointerEvent, useId, useMemo, useState } from 'react'

import { getCronJobs } from '@/api/cron'
import { getUsageAnalytics } from '@/api/models'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { useI18n } from '@/i18n'
import { BarChart3, RefreshCw, TrendingDown, TrendingUp } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { $activeGatewayProfile } from '@/store/profile'

import {
  $insightPrefs,
  areaPath,
  comparePeriods,
  formatMetric,
  INSIGHT_METRICS,
  INSIGHT_RANGES,
  type InsightDays,
  type InsightMetric,
  linePath,
  nearestIndex,
  setInsightPrefs,
  sparkPoints,
  topModel
} from './insights-stats'
import { deriveJarvisMetrics } from './metrics'
import { RailCard } from './rail-card'
import type { JarvisUiState } from './types'

const INSIGHTS_REFRESH_MS = 5 * 60_000
const CHART_W = 240
const CHART_H = 64

const COPY = {
  en: {
    apiCalls: 'Model calls',
    chart: 'Chart',
    days: (n: number) => `${n} d`,
    metrics: { cost: 'Cost', sessions: 'Sessions', tokens: 'Tokens' },
    noData: 'Nothing in this period yet.',
    period: 'Period',
    refresh: 'Refresh statistics',
    session: 'This conversation',
    tokens: 'Tokens',
    topModel: 'Top model',
    topSkill: 'Top skill',
    topTool: 'Top tool',
    updated: (time: string) => `Updated ${time}`,
    versus: (n: number) => `vs previous ${n} days`
  },
  pl: {
    apiCalls: 'Wywołania modelu',
    chart: 'Wykres',
    days: (n: number) => `${n} dni`,
    metrics: { cost: 'Koszt', sessions: 'Sesje', tokens: 'Tokeny' },
    noData: 'W tym okresie jeszcze nic.',
    period: 'Okres',
    refresh: 'Odśwież statystyki',
    session: 'Ta rozmowa',
    tokens: 'Tokeny',
    topModel: 'Najczęstszy model',
    topSkill: 'Najczęstsza umiejętność',
    topTool: 'Najczęstsze narzędzie',
    updated: (time: string) => `Zaktualizowano ${time}`,
    versus: (n: number) => `vs poprzednie ${n} dni`
  }
} as const

function Tile({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={cn('flex min-h-12 min-w-0 flex-col justify-center gap-0.5', wide && 'col-span-2')}>
      <dt className="truncate text-xs text-(--ui-text-secondary)">{label}</dt>
      <dd className="truncate text-lg font-semibold tabular-nums text-(--ui-text-primary)" title={value}>
        {value}
      </dd>
    </div>
  )
}

/** The curve with a scrubber: hover, touch or arrow keys pick a day and read its value. */
function TrendChart({
  days,
  label,
  locale,
  metric,
  series
}: {
  days: number
  label: string
  locale: string
  metric: InsightMetric
  series: readonly number[]
}) {
  const gradientId = useId()
  const [picked, setPicked] = useState<null | number>(null)
  const points = useMemo(() => sparkPoints(series, CHART_W, CHART_H), [series])
  const active = picked ?? series.length - 1
  const [x, y] = points[active] ?? [0, 0]

  const dayOf = (index: number) => {
    const date = new Date()

    date.setDate(date.getDate() - (series.length - 1 - index))

    return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(date)
  }

  const reading = `${dayOf(active)} · ${formatMetric(series[active] ?? 0, metric, locale)}`

  const onPointer = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect()

    setPicked(nearestIndex(event.clientX - box.left, box.width, series.length))
  }

  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0

    if (step) {
      event.preventDefault()
      setPicked(Math.min(series.length - 1, Math.max(0, active + step)))
    } else if (event.key === 'Escape') {
      setPicked(null)
    }
  }

  return (
    <div className="mb-3">
      <div
        aria-label={label}
        aria-valuemax={series.length - 1}
        aria-valuemin={0}
        aria-valuenow={active}
        aria-valuetext={reading}
        className="relative h-16 w-full touch-none rounded-lg outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-(--ui-accent)"
        data-testid="insights-chart"
        onBlur={() => setPicked(null)}
        onKeyDown={onKey}
        onPointerLeave={() => setPicked(null)}
        onPointerMove={onPointer}
        role="slider"
        tabIndex={0}
      >
        <svg
          aria-hidden="true"
          className="absolute inset-0 size-full overflow-visible"
          preserveAspectRatio="none"
          viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#22d3ee" />
              <stop offset="100%" stopColor="#a855f7" />
            </linearGradient>
            <linearGradient id={`${gradientId}-fill`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#a855f7" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaPath(points, CHART_H)} fill={`url(#${gradientId}-fill)`} />
          <path
            d={linePath(points)}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeLinecap="round"
            strokeWidth="2.5"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-(--ui-accent) shadow-[0_0_10px_var(--ui-accent)] transition-[left,top] duration-150"
          style={{ left: `${(x / CHART_W) * 100}%`, top: `${(y / CHART_H) * 100}%` }}
        />
      </div>
      <div aria-live="polite" className="mt-1 flex items-center justify-between text-xs text-(--ui-text-tertiary)">
        <span>{dayOf(0)}</span>
        <span className="font-medium text-(--ui-text-secondary)" data-testid="insights-reading">
          {reading}
        </span>
        <span>{days > 1 ? dayOf(series.length - 1) : ''}</span>
      </div>
    </div>
  )
}

/** Usage over a window you choose, what changed against the window before, and this conversation's own signals. */
export function JarvisInsightsCard({ connected, state }: { connected: boolean; state: JarvisUiState }) {
  const { locale, t } = useI18n()
  const base = t.jarvisShell.home.insights
  const copy = locale === 'pl' ? COPY.pl : COPY.en
  const profile = useStore($activeGatewayProfile)
  const { days, metric } = useStore($insightPrefs)

  // Twice the window: the second half is what "change" is measured against.
  const analytics = useQuery({
    enabled: connected,
    queryFn: () => getUsageAnalytics(days * 2),
    queryKey: ['jarvis-insights-analytics', profile, days],
    refetchInterval: INSIGHTS_REFRESH_MS,
    staleTime: INSIGHTS_REFRESH_MS
  })

  const jobs = useQuery({
    enabled: connected,
    queryFn: () => getCronJobs(),
    queryKey: ['jarvis-insights-jobs', profile],
    refetchInterval: INSIGHTS_REFRESH_MS,
    staleTime: INSIGHTS_REFRESH_MS
  })

  const period = useMemo(
    () => (analytics.data ? comparePeriods(analytics.data.daily, new Date(), days, metric) : null),
    [analytics.data, days, metric]
  )

  const windowTotals = useMemo(() => {
    const today = new Date()

    if (!analytics.data) {
      return null
    }

    const sessions = comparePeriods(analytics.data.daily, today, days, 'sessions').total
    const tokens = comparePeriods(analytics.data.daily, today, days, 'tokens').total
    const cost = comparePeriods(analytics.data.daily, today, days, 'cost').total

    return { cost, sessions, tokens }
  }, [analytics.data, days])

  const calls = analytics.data
    ? analytics.data.daily.slice(-days).reduce((n, entry) => n + (entry.api_calls || 0), 0)
    : null

  const best = analytics.data ? topModel(analytics.data.by_model) : null
  const bestTool = analytics.data?.tools?.[0]
  const bestSkill = analytics.data?.skills.top_skills[0]
  const activeJobs = jobs.data ? jobs.data.filter(job => job.enabled).length : null
  const metrics = deriveJarvisMetrics(state.activity)
  const number = new Intl.NumberFormat(locale)
  const activityTime = metrics.events > 0 ? `${Math.ceil(metrics.spanMs / 60_000)} min` : '—'

  const lastActivity =
    metrics.lastAt === null
      ? '—'
      : new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(metrics.lastAt)

  const updated = analytics.dataUpdatedAt
    ? new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(analytics.dataUpdatedAt)
    : null

  const change = period?.changePct ?? null

  return (
    <RailCard
      action={
        <button
          aria-label={copy.refresh}
          className="grid size-8 place-items-center rounded-md text-(--ui-text-tertiary) outline-none hover:text-(--ui-text-primary) focus-visible:outline focus-visible:outline-2 focus-visible:outline-(--ui-accent)"
          disabled={!connected || analytics.isFetching}
          onClick={() => void analytics.refetch()}
          title={updated ? copy.updated(updated) : copy.refresh}
          type="button"
        >
          <RefreshCw className={cn('size-3.5', analytics.isFetching && 'animate-spin')} />
        </button>
      }
      icon={BarChart3}
      testId="insights"
      title={base.title}
    >
      <div className="mb-3 grid gap-2">
        <SegmentedControl<InsightMetric>
          className="w-full"
          onChange={next => setInsightPrefs({ metric: next })}
          options={INSIGHT_METRICS.map(id => ({ id, label: copy.metrics[id] }))}
          value={metric}
        />
        <SegmentedControl<`${InsightDays}`>
          className="w-full"
          onChange={next => setInsightPrefs({ days: Number(next) as InsightDays })}
          options={INSIGHT_RANGES.map(id => ({ id: `${id}` as const, label: copy.days(id) }))}
          value={`${days}`}
        />
      </div>

      {period && period.total > 0 ? (
        <>
          <div className="mb-2 flex items-end justify-between gap-2">
            <p className="text-2xl font-semibold tabular-nums text-(--ui-text-primary)" data-testid="insights-total">
              {formatMetric(period.total, metric, locale)}
            </p>
            {change === null ? null : (
              <p
                className={cn(
                  'flex items-center gap-1 pb-1 text-xs font-medium',
                  change >= 0 ? 'text-emerald-500' : 'text-amber-500'
                )}
                data-testid="insights-change"
                title={copy.versus(days)}
              >
                {change >= 0 ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
                {change > 0 ? '+' : ''}
                {change}%
              </p>
            )}
          </div>
          <TrendChart days={days} label={copy.chart} locale={locale} metric={metric} series={period.series} />
        </>
      ) : (
        <p className="mb-3 text-xs text-(--ui-text-tertiary)">{analytics.isPending ? '…' : copy.noData}</p>
      )}

      {windowTotals ? (
        <dl className="mb-3 grid grid-cols-2 gap-x-4 gap-y-2" data-testid="insights-window">
          <Tile label={copy.metrics.sessions} value={number.format(windowTotals.sessions)} />
          <Tile label={copy.tokens} value={formatMetric(windowTotals.tokens, 'tokens', locale)} />
          <Tile label={copy.metrics.cost} value={formatMetric(windowTotals.cost, 'cost', locale)} />
          <Tile label={copy.apiCalls} value={calls === null ? '—' : number.format(calls)} />
          {best ? <Tile label={copy.topModel} value={`${best.model.split('/').pop()} · ${best.share}%`} wide /> : null}
          {bestTool ? <Tile label={copy.topTool} value={bestTool.tool} wide /> : null}
          {bestSkill ? <Tile label={copy.topSkill} value={bestSkill.skill} wide /> : null}
        </dl>
      ) : null}

      <p className="mb-1 text-xs font-medium uppercase tracking-[0.16em] text-(--ui-text-tertiary)">{copy.session}</p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
        <Tile label={base.completedTasks} value={String(metrics.verified)} />
        <Tile label={base.activeJobs} value={String(activeJobs ?? '—')} />
        <Tile label={base.activityTime} value={activityTime} />
        <Tile label={base.lastActivity} value={lastActivity} />
        <Tile label={base.pendingApproval} value={String(state.task.phase === 'approval' ? 1 : 0)} />
      </dl>
    </RailCard>
  )
}
