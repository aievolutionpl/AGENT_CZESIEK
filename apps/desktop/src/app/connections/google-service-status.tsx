import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import type { ProfileScope } from '@/api/client'
import { getGoogleStatus, type GoogleVerifyResult, verifyGoogle } from '@/api/google'
import { Button } from '@/components/ui/button'
import { useActiveCapabilityScope } from '@/hooks/use-active-capability-scope'
import { useI18n } from '@/i18n'

const SERVICES = [
  { id: 'gmail', label: 'Gmail', scope: 'gmail' },
  { id: 'calendar', label: 'Kalendarz', scope: 'calendar' },
  { id: 'drive', label: 'Dysk', scope: 'drive' }
] as const

const STATES = {
  connected: ['Połączenie potwierdzone', 'Connection confirmed'],
  reauthorize: ['Zaloguj się ponownie', 'Sign in again'],
  permission: ['Brak uprawnień lub wyłączone API', 'Permission missing or API disabled'],
  rate_limit: ['Limit usługi — spróbuj później', 'Rate limit — try later'],
  unavailable: ['Usługa nie odpowiedziała — ponów test', 'Service unavailable — retry'],
  unconfigured: ['Brak konfiguracji', 'Not configured'],
  unchecked: ['Jeszcze nie sprawdzono', 'Not checked yet']
} as const

export function GoogleServiceResults({ result }: { result: GoogleVerifyResult }) {
  const { locale } = useI18n()
  const pl = locale === 'pl'

  return (
    <div className="grid gap-2" role="status">
      {SERVICES.map(service => {
        const flag = result[`${service.id}_ok`]

        const state =
          result.services?.[service.id]?.state ??
          (flag === true ? 'connected' : flag === false ? 'unavailable' : 'unchecked')

        return (
          <div
            className="jarvis-well flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
            key={service.id}
          >
            <strong>
              {pl ? service.label : service.id === 'gmail' ? 'Gmail' : service.id === 'calendar' ? 'Calendar' : 'Drive'}
            </strong>
            <span>{STATES[state][pl ? 0 : 1]}</span>
          </div>
        )
      })}
      {result.checked_at ? (
        <p className="text-xs text-(--ui-text-secondary)">
          {pl ? 'Ostatni test: ' : 'Last checked: '}
          {new Date(result.checked_at).toLocaleString(pl ? 'pl-PL' : 'en-GB')}
        </p>
      ) : null}
    </div>
  )
}

export function GoogleServiceStatus({ onReconnect }: { onReconnect: () => void }) {
  const { scope, scopeKey } = useActiveCapabilityScope()

  return <ScopedGoogleStatus key={scopeKey} onReconnect={onReconnect} scope={scope} scopeKey={scopeKey} />
}

function ScopedGoogleStatus({
  onReconnect,
  scope,
  scopeKey
}: {
  onReconnect: () => void
  scope: ProfileScope
  scopeKey: string
}) {
  const { locale } = useI18n()
  const pl = locale === 'pl'

  const status = useQuery({
    queryKey: ['google-service-config', scopeKey],
    queryFn: () => getGoogleStatus(scope),
    retry: false
  })

  const [result, setResult] = useState<GoogleVerifyResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  const test = async () => {
    setBusy(true)
    setResult(null)
    setFailed(false)

    try {
      setResult(await verifyGoogle(scope))
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-label={pl ? 'Usługi Google' : 'Google services'} className="grid gap-3">
      {result ? (
        <GoogleServiceResults result={result} />
      ) : (
        SERVICES.map(service => (
          <div className="jarvis-well grid gap-1 px-3 py-2 text-sm" key={service.id}>
            <strong>
              {pl ? service.label : service.id === 'gmail' ? 'Gmail' : service.id === 'calendar' ? 'Calendar' : 'Drive'}
            </strong>
            <span>
              {status.isPending
                ? pl
                  ? 'Sprawdzam konfigurację…'
                  : 'Checking configuration…'
                : status.isError
                  ? pl
                    ? 'Nie udało się odczytać konfiguracji.'
                    : 'Could not read configuration.'
                  : status.data?.token
                    ? pl
                      ? 'Zapisano dane — wykonaj test połączenia.'
                      : 'Credentials saved — test the connection.'
                    : pl
                      ? 'Brak konfiguracji.'
                      : 'Not configured.'}
            </span>
            {status.data?.services.some(item => item.startsWith(service.scope)) ? (
              <span className="text-xs text-(--ui-text-secondary)">
                {pl ? 'Przyznane zakresy: ' : 'Granted scopes: '}
                {status.data.services.filter(item => item.startsWith(service.scope)).join(', ')}
              </span>
            ) : null}
          </div>
        ))
      )}
      {failed ? (
        <p role="alert">
          {pl
            ? 'Nie udało się wykonać testu. Sprawdź połączenie i spróbuj ponownie.'
            : 'Could not run the test. Check the connection and retry.'}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy || !status.data?.token} onClick={() => void test()} size="sm" variant="secondary">
          {busy ? (pl ? 'Sprawdzam…' : 'Checking…') : pl ? 'Przetestuj' : 'Test connection'}
        </Button>
        <Button onClick={onReconnect} size="sm" variant="ghost">
          {pl ? 'Połącz ponownie' : 'Reconnect'}
        </Button>
      </div>
    </section>
  )
}
