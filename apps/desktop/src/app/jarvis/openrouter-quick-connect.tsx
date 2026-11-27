import { type FormEvent, useEffect, useRef, useState } from 'react'

import { type ProfileScope, profileScopeKey } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useI18n } from '@/i18n'
import { openExternalLink } from '@/lib/external-link'
import { ExternalLink, Loader2, Zap } from '@/lib/icons'
import { cn } from '@/lib/utils'

import {
  connectOpenRouter,
  defaultOpenRouterConnectDeps,
  OPENROUTER_KEYS_URL,
  type OpenRouterConnectDeps,
  type OpenRouterConnectResult
} from './openrouter-connect'

export interface OpenRouterQuickConnectProps {
  className?: string
  deps?: OpenRouterConnectDeps
  onConnected: (result: Extract<OpenRouterConnectResult, { ok: true }>) => void
  scope?: ProfileScope
  /** `dark` for the onboarding's fixed dark palette; `app` follows the theme. */
  tone?: 'app' | 'dark'
}

const TONES = {
  app: {
    hint: 'text-(--ui-text-secondary)',
    input: '',
    link: 'text-(--ui-accent)',
    muted: 'text-(--ui-text-tertiary)'
  },
  dark: {
    hint: 'text-[#C7CBD1]',
    input: 'border-white/15 bg-black/40 text-white placeholder:text-white/40',
    link: 'text-[#00B7FF]',
    muted: 'text-[#9299A5]'
  }
} as const

/** Paste an OpenRouter key and start working — the rail's and onboarding's shared path. */
export function OpenRouterQuickConnect({
  className,
  deps = defaultOpenRouterConnectDeps,
  onConnected,
  scope,
  tone = 'app'
}: OpenRouterQuickConnectProps) {
  const palette = TONES[tone]
  const { t } = useI18n()
  const copy = t.jarvisShell.openRouterConnect
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const scopeKey = profileScopeKey(scope)
  const currentScopeKey = useRef(scopeKey)
  currentScopeKey.current = scopeKey
  const attempt = useRef<AbortController | null>(null)

  // Scope changes cancel the old attempt and release the form for the new target.
  // eslint-disable-next-line no-restricted-syntax
  useEffect(() => {
    setBusy(false)
    setError('')

    return () => {
      attempt.current?.abort()
      attempt.current = null
    }
  }, [scopeKey])

  const submit = async (event: FormEvent) => {
    event.preventDefault()

    if (busy) {
      return
    }

    const controller = new AbortController()
    attempt.current = controller
    setBusy(true)
    setError('')

    try {
      const result = await connectOpenRouter(key, deps, scope, { signal: controller.signal })

      if (attempt.current !== controller || controller.signal.aborted || currentScopeKey.current !== scopeKey) {
        return
      }

      if (result.ok) {
        setKey('')
        onConnected(result)
      } else {
        const persistenceMessage =
          result.keySaved === true
            ? copy.savedIncomplete
            : result.keySaved === 'unknown'
              ? copy.saveUnknown
              : copy.failed

        const reasons: Partial<Record<typeof result.reason, string>> = { empty: copy.empty, rejected: copy.rejected }
        setError(reasons[result.reason] ?? persistenceMessage)
      }
    } catch {
      if (attempt.current === controller) {
        setError(copy.failed)
      }
    } finally {
      if (attempt.current === controller) {
        attempt.current = null
        setBusy(false)
      }
    }
  }

  return (
    <form
      className={cn('grid gap-2', className)}
      data-testid="openrouter-quick-connect"
      onSubmit={event => void submit(event)}
    >
      <p className={cn('text-xs leading-5', palette.hint)}>{copy.hint}</p>
      <div className="flex min-w-0 gap-2">
        <Input
          aria-label={copy.label}
          className={cn('min-h-11 min-w-0 flex-1 font-mono text-xs', palette.input)}
          disabled={busy}
          onChange={event => setKey(event.target.value)}
          placeholder="sk-or-v1-…"
          type="password"
          value={key}
        />
        <Button className="min-h-11 shrink-0" disabled={busy || !key.trim()} type="submit">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
          {busy ? copy.connecting : copy.submit}
        </Button>
      </div>
      {busy ? (
        <Button
          onClick={() => {
            attempt.current?.abort()
            attempt.current = null
            setBusy(false)
            setError(copy.saveUnknown)
          }}
          type="button"
          variant="text"
        >
          {t.common.cancel}
        </Button>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          className={cn(
            'inline-flex min-h-8 items-center gap-1 text-xs outline-none hover:underline focus-visible:underline',
            palette.link
          )}
          onClick={() => openExternalLink(OPENROUTER_KEYS_URL)}
          type="button"
        >
          {copy.getKey}
          <ExternalLink className="size-3" />
        </button>
        <span className={cn('text-[0.7rem]', palette.muted)}>{copy.defaultModel}</span>
      </div>
      {error ? (
        <p className="text-xs text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  )
}
