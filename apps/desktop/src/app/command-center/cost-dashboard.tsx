import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { type CostScope, type CostsResponse, CostsUnavailableError, getCosts, refreshCosts } from '@/api/costs'
import { Button } from '@/components/ui/button'

import { CostBreakdown, CostRows, CostTotalsGrid } from './cost-breakdown'
import { costQueryKey, type CostQueryState, createCostQuery, queryWithFilters } from './cost-query'

export interface CostDashboardProps {
  scope: CostScope
  onScopeChange: (scope: CostScope) => void
  onOpenSession: (storedSessionId: string) => void
}

export function CostDashboard({ scope, onScopeChange, onOpenSession }: CostDashboardProps) {
  const [query, setQuery] = useState<CostQueryState>(() => createCostQuery())
  const [response, setResponse] = useState<CostsResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const requestRef = useRef(0)
  const queryInput = useMemo(() => queryWithFilters(query), [query])
  const key = useMemo(() => costQueryKey(scope, queryInput).join('|'), [queryInput, scope])

  const load = useCallback(
    async (refresh = false) => {
      const requestId = ++requestRef.current
      setError(null)
      refresh ? setRefreshing(true) : setLoading(true)

      try {
        const next = refresh
          ? await refreshCosts({ from: query.from, to: query.to, max_records: 100 }, scope)
          : await getCosts(queryInput, scope)

        if (requestRef.current === requestId) {
          setResponse(next)
        }
      } catch (cause) {
        if (requestRef.current === requestId) {
          setError(
            cause instanceof CostsUnavailableError
              ? 'Cost dashboard is unavailable on this backend.'
              : cause instanceof Error
                ? cause.message
                : String(cause)
          )
        }
      } finally {
        if (requestRef.current === requestId) {
          setLoading(false)
          setRefreshing(false)
        }
      }
    },
    [query.from, query.to, queryInput, scope]
  )

  useEffect(() => {
    void load()
  }, [key, load])

  const setFilter = (name: keyof CostQueryState, value: string) =>
    setQuery(current => ({ ...current, [name]: value, cursor: undefined }))

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto pb-2" data-testid="cost-dashboard">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs text-(--ui-text-tertiary)">
          Period{' '}
          <select
            aria-label="Cost period"
            className="ml-1 rounded border border-(--ui-stroke-tertiary) bg-transparent px-2 py-1 text-foreground"
            onChange={event => setQuery(current => ({ ...current, ...createCostQuery(Number(event.target.value)) }))}
            value={String(Math.round((new Date(query.to).getTime() - new Date(query.from).getTime()) / 86_400_000))}
          >
            <option value="7">7 days</option>
            <option value="30">30 days</option>
            <option value="90">90 days</option>
          </select>
        </label>
        <label className="text-xs text-(--ui-text-tertiary)">
          Attribution{' '}
          <select
            aria-label="Cost attribution"
            className="ml-1 rounded border border-(--ui-stroke-tertiary) bg-transparent px-2 py-1 text-foreground"
            onChange={event =>
              setQuery(current => ({
                ...current,
                attribution: event.target.value as 'desktop' | 'all',
                cursor: undefined
              }))
            }
            value={query.attribution}
          >
            <option value="desktop">This app's work</option>
            <option value="all">All profile work</option>
          </select>
        </label>
        <input
          aria-label="Provider filter"
          className="rounded border border-(--ui-stroke-tertiary) bg-transparent px-2 py-1 text-xs text-foreground"
          onChange={event => setFilter('provider', event.target.value)}
          placeholder="Provider"
          value={query.provider}
        />
        <Button onClick={() => void load(true)} size="xs" variant="text">
          {refreshing ? 'Refreshing…' : 'Refresh reconciliation'}
        </Button>
      </div>
      {error && (
        <div className="rounded border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200" role="status">
          {error}
        </div>
      )}
      {loading && !response ? (
        <div className="grid min-h-32 place-items-center text-sm text-(--ui-text-tertiary)">Loading costs…</div>
      ) : response ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-(--ui-text-tertiary)">
              {response.period.from.slice(0, 10)} → {response.period.to.slice(0, 10)} · scope {scope.profile}
            </div>
            <div className="text-xs text-(--ui-text-tertiary)">
              Refresh: {response.refresh.status} · checked {response.refresh.checked} · pending{' '}
              {response.refresh.pending}
            </div>
          </div>
          <CostTotalsGrid totals={response.totals} />
          <CostBreakdown
            byModel={response.by_model}
            bySession={response.by_session}
            byWork={response.by_work}
            onOpenSession={onOpenSession}
          />
          <CostRows onOpenSession={onOpenSession} rows={response.rows} />
          <section className="rounded border border-(--ui-stroke-tertiary) p-3">
            <h3 className="text-xs font-medium text-foreground">OpenRouter key-wide usage</h3>
            <p className="mt-1 text-xs text-(--ui-text-tertiary)">
              {response.openrouter_key.status} · ${response.openrouter_key.usage_usd ?? '—'} USD. This is not this app's
              spend.
            </p>
          </section>
        </>
      ) : (
        <div className="text-sm text-(--ui-text-tertiary)">No cost records for this period.</div>
      )}
      <label className="text-xs text-(--ui-text-tertiary)">
        Profile
        <input
          aria-label="Cost profile"
          className="ml-1 rounded border border-(--ui-stroke-tertiary) bg-transparent px-2 py-1 text-foreground"
          onChange={event => onScopeChange({ ...scope, profile: event.target.value || 'default' })}
          value={scope.profile}
        />
      </label>
    </div>
  )
}
