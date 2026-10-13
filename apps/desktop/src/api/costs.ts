import { capabilityScoped, hermesApi } from './client'

export interface CostScope {
  connectionId: string
  profile: string
}

export interface CostPeriod {
  from: string
  to: string
}

export interface CostTokens {
  input_tokens: number | null
  output_tokens: number | null
  cache_read_tokens: number | null
  cache_write_tokens: number | null
  reasoning_tokens: number | null
}

export interface RequestCostRow {
  record_id: string
  request_id: string | null
  generation_id: string | null
  session_id: string
  turn_id: string | null
  parent_session_id: string | null
  parent_turn_id: string | null
  work_session_id: string | null
  work_turn_id: string | null
  category: 'main' | 'delegated' | 'auxiliary'
  task: string | null
  app_attribution: 'desktop' | 'other' | 'unknown'
  provider: string | null
  model: string | null
  upstream_provider: string | null
  provider_route_id: string | null
  occurred_at: string
  tokens: CostTokens
  reported_cost_usd: string | null
  reconciled_cost_usd: string | null
  estimated_cost_usd: string | null
  cost_status: 'confirmed' | 'estimated' | 'unknown'
  reconciliation: 'not_applicable' | 'pending' | 'confirmed' | 'stale' | 'unavailable' | 'credential_changed'
  reconciled_at: string | null
}

export interface CostTotals {
  request_count: number
  confirmed_usd: string
  estimated_usd: string
  unknown_requests: number
  unattributed_requests: number
  tokens: CostTokens
}

export interface WorkCostGroup extends CostTotals {
  work_session_id: string | null
  work_turn_id: string | null
}

export interface SessionCostGroup extends CostTotals {
  session_id: string
}

export interface ModelCostGroup extends CostTotals {
  provider: string | null
  provider_route_id: string | null
  model: string | null
}

export interface LegacyCostSummary {
  source: 'legacy_session_aggregates'
  estimated_usd: string | null
  session_count: number
  included_in_request_totals: false
  per_work_available: false
}

export interface OpenRouterSpendSource {
  source: 'openrouter_key'
  scope: 'key_wide'
  currency: 'USD'
  credential_ref: string | null
  status: 'fresh' | 'stale' | 'unavailable' | 'not_configured' | 'credential_changed'
  fetched_at: string | null
  last_attempt_at: string | null
  usage_usd: string | null
  usage_daily_usd: string | null
  usage_weekly_usd: string | null
  usage_monthly_usd: string | null
  byok_usage_usd: string | null
  limit_usd: string | null
  limit_remaining_usd: string | null
  limit_reset: string | null
  error_code: string | null
}

export interface CostRefreshState {
  status: 'idle' | 'running' | 'complete' | 'partial' | 'failed'
  checked: number
  pending: number
  failed: number
  last_attempt_at: string | null
  last_success_at: string | null
  error_code: string | null
}

export interface CostsResponse {
  schema_version: 1
  profile: string
  period: CostPeriod
  attribution: 'desktop' | 'all'
  provider_filter: string | null
  totals: CostTotals
  by_work: WorkCostGroup[]
  by_session: SessionCostGroup[]
  by_model: ModelCostGroup[]
  rows: RequestCostRow[]
  next_cursor: string | null
  legacy: LegacyCostSummary
  openrouter_key: OpenRouterSpendSource
  refresh: CostRefreshState
}

export interface CostsQuery extends CostPeriod {
  attribution: 'desktop' | 'all'
  provider?: string
  session_id?: string
  work_session_id?: string
  work_turn_id?: string
  cursor?: string
  limit?: number
}

export interface CostsRefreshRequest extends CostPeriod {
  max_records: number
}

export class CostsUnavailableError extends Error {
  readonly unavailable = true

  constructor() {
    super('Cost ledger is unavailable on this backend')
    this.name = 'CostsUnavailableError'
  }
}

function queryString(query: CostsQuery): string {
  const params = new URLSearchParams({ from: query.from, to: query.to, attribution: query.attribution })

  for (const key of ['provider', 'session_id', 'work_session_id', 'work_turn_id', 'cursor'] as const) {
    const value = query[key]

    if (value) {
      params.set(key, value)
    }
  }

  if (query.limit !== undefined) {
    params.set('limit', String(query.limit))
  }

  return params.toString()
}

async function requestCosts<T>(request: { method: 'GET' | 'POST'; path: string; body?: unknown }, scope: CostScope) {
  try {
    return await hermesApi<T>({ ...capabilityScoped(scope), ...request })
  } catch (error) {
    if (error instanceof Error && /404|not found|unsupported/i.test(error.message)) {
      throw new CostsUnavailableError()
    }

    throw error
  }
}

export function getCosts(query: CostsQuery, scope: CostScope): Promise<CostsResponse> {
  return requestCosts<CostsResponse>({ method: 'GET', path: `/api/analytics/costs?${queryString(query)}` }, scope)
}

export function refreshCosts(body: CostsRefreshRequest, scope: CostScope): Promise<CostsResponse> {
  return requestCosts<CostsResponse>({ method: 'POST', path: '/api/analytics/costs/refresh', body }, scope)
}
