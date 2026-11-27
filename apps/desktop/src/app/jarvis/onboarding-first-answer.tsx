import { type FormEvent, useEffect, useRef, useState } from 'react'

import type { ChatBarProps } from '@/app/chat/composer/types'
import type { HermesGateway } from '@/hermes'

import { type JarvisOnboardingScope, normalizeJarvisOnboardingScope } from './onboarding-state'

export interface OnboardingFirstAnswerProps {
  scope: JarvisOnboardingScope
  gateway: HermesGateway | null
  runtimeSessionId: string | null
  storedSessionId: string | null
  onSubmit: ChatBarProps['onSubmit']
  onVerified: (result: { runtimeSessionId: string; storedSessionId: string }) => void
}

function answerText(payload: unknown): string {
  if (!payload || typeof payload !== 'object') {
    return ''
  }
  const value = payload as Record<string, unknown>

  if (typeof value.text === 'string') {
    return value.text.trim()
  }

  if (typeof value.content === 'string') {
    return value.content.trim()
  }

  if (typeof value.assistant === 'string') {
    return value.assistant.trim()
  }

  return ''
}

/** A tiny first-turn probe. It verifies the terminal answer, not the submit ACK. */
export function OnboardingFirstAnswer({
  gateway,
  onSubmit,
  onVerified,
  runtimeSessionId,
  scope,
  storedSessionId
}: OnboardingFirstAnswerProps) {
  const [value, setValue] = useState('')
  const [pending, setPending] = useState(false)
  const owner = normalizeJarvisOnboardingScope(scope)
  const ownerRef = useRef(owner)
  const idsRef = useRef({ runtime: runtimeSessionId, stored: storedSessionId })

  // Latest-value refs are assigned during render, never mirrored through an effect:
  // a message arriving between render and effect would otherwise read stale owner/ids.
  ownerRef.current = owner
  idsRef.current = { runtime: runtimeSessionId, stored: storedSessionId }

  useEffect(() => {
    if (!gateway) {
      return
    }

    return gateway.on('message.complete', event => {
      if (!pending || (event.profile && event.profile !== ownerRef.current.profile)) {
        return
      }

      if (event.connectionId && event.connectionId !== ownerRef.current.connectionId) {
        return
      }

      if (
        event.payload &&
        typeof event.payload === 'object' &&
        (event.payload as Record<string, unknown>).status === 'error'
      ) {
        return
      }

      const runtime = String(event.session_id || idsRef.current.runtime || '')
      const payload = (event.payload && typeof event.payload === 'object' ? event.payload : {}) as Record<
        string,
        unknown
      >
      const stored = String(payload.stored_session_id || idsRef.current.stored || '')

      if (!runtime || !stored || !answerText(event.payload)) {
        return
      }

      if (idsRef.current.runtime && runtime !== idsRef.current.runtime) {
        return
      }

      if (idsRef.current.stored && stored !== idsRef.current.stored) {
        return
      }

      setPending(false)
      onVerified({ runtimeSessionId: runtime, storedSessionId: stored })
    })
  }, [gateway, onVerified, pending])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const prompt = value.trim()

    if (!prompt || pending) {
      return
    }
    setPending(true)

    try {
      const accepted = await onSubmit(prompt)

      if (accepted === false) {
        setPending(false)
      }
    } catch {
      setPending(false)
    }
  }

  return (
    <form data-testid="onboarding-first-answer" onSubmit={event => void submit(event)}>
      <label>
        Test the connection
        <input disabled={pending} onChange={event => setValue(event.target.value)} value={value} />
      </label>
      <button disabled={pending || !value.trim()} type="submit">
        {pending ? 'Waiting for an answer…' : 'Send test message'}
      </button>
    </form>
  )
}
