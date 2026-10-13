/**
 * Setup step: how much of this computer Jarvis may work on.
 *
 * The three cards are the honest version of "asystent, który pracuje na
 * komputerze" — each one names the toolsets it turns on, and the one that
 * drives the screen shows the backend's real cua-driver readiness instead of
 * promising something the machine cannot do yet. A user who picks Operator on
 * a machine without the driver sees that here, in setup, not the first time
 * they ask for a screenshot.
 *
 * Nothing is written from this step. The chosen mode is a selection like any
 * other; the toolsets are applied when the wizard finishes, after the model
 * and config transaction has committed.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { getComputerUseStatus, grantComputerUsePermissions } from '@/hermes'
import type { Translations } from '@/i18n'
import {
  AlertTriangle,
  Check,
  ExternalLink,
  FolderOpen,
  Loader2,
  MessageSquareText,
  Monitor,
  RefreshCw
} from '@/lib/icons'
import type { ActionResponse, ComputerUseStatus } from '@/types/hermes'

import {
  computerModeNeedsDesktopControl,
  describeComputerReadiness,
  JARVIS_COMPUTER_MODES,
  type JarvisComputerMode,
  type JarvisComputerReadiness
} from './computer-capabilities'
import { ChoiceCard, choiceRadioKeyHandler } from './onboarding-choice-card'

type ComputerCopy = Translations['jarvisOnboarding']['computer']

const MODE_ICONS: Record<JarvisComputerMode, React.ComponentType<{ className?: string }>> = {
  assist: FolderOpen,
  chat: MessageSquareText,
  operator: Monitor
}

export interface ComputerStepProps {
  copy: ComputerCopy
  /** Test seam over the backend's macOS TCC grant flow. */
  grantPermissions?: () => Promise<ActionResponse>
  /** Test seam over the backend's cross-platform readiness probe. */
  loadStatus?: () => Promise<ComputerUseStatus>
  mode: JarvisComputerMode
  onSelect: (mode: JarvisComputerMode) => void
}

export function ComputerStep({
  copy,
  grantPermissions = grantComputerUsePermissions,
  loadStatus = getComputerUseStatus,
  mode,
  onSelect
}: ComputerStepProps) {
  const [status, setStatus] = useState<ComputerUseStatus | null>(null)
  const [checking, setChecking] = useState(false)
  const [granting, setGranting] = useState(false)
  const [error, setError] = useState('')
  const mounted = useRef(true)
  const needsDriver = computerModeNeedsDesktopControl(mode)

  useEffect(
    () => () => {
      mounted.current = false
    },
    []
  )

  const refresh = useCallback(async () => {
    setChecking(true)
    setError('')

    try {
      const next = await loadStatus()

      if (mounted.current) {
        setStatus(next)
      }
    } catch {
      if (mounted.current) {
        // A probe that cannot run is not a machine that cannot work: the step
        // stays usable and says only that readiness is unknown.
        setStatus(null)
        setError(copy.statusUnavailable)
      }
    } finally {
      if (mounted.current) {
        setChecking(false)
      }
    }
  }, [copy.statusUnavailable, loadStatus])

  useEffect(() => {
    if (needsDriver && status === null && !checking) {
      void refresh()
    }
    // Probing is tied to picking the mode that needs the driver, not to every
    // render of this step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsDriver])

  const grant = async () => {
    setGranting(true)

    try {
      await grantPermissions()
    } catch {
      if (mounted.current) {
        setError(copy.grantFailed)
      }
    } finally {
      if (mounted.current) {
        setGranting(false)
      }
    }
  }

  const readiness = describeComputerReadiness(status)

  return (
    <fieldset className="grid gap-4">
      <legend className="text-lg font-semibold">{copy.title}</legend>
      <p className="max-w-2xl text-sm leading-6 text-(--ui-text-secondary)">{copy.body}</p>
      <div
        aria-label={copy.title}
        className="grid gap-2 sm:grid-cols-3"
        onKeyDown={choiceRadioKeyHandler({
          attribute: 'data-computer-mode',
          current: mode,
          onSelect,
          values: JARVIS_COMPUTER_MODES
        })}
        role="radiogroup"
      >
        {JARVIS_COMPUTER_MODES.map(item => {
          const Icon = MODE_ICONS[item]

          return (
            <ChoiceCard
              active={mode === item}
              data-computer-mode={item}
              description={copy.modes[item].hint}
              icon={<Icon className="size-4" />}
              key={item}
              label={copy.modes[item].label}
              onClick={() => onSelect(item)}
              role="radio"
              tabIndex={mode === item ? 0 : -1}
            />
          )
        })}
      </div>
      <p className="text-sm text-(--ui-text-secondary)">{copy.modes[mode].tools}</p>

      {needsDriver ? (
        <DesktopControlStatus
          checking={checking}
          copy={copy}
          error={error}
          granting={granting}
          onGrant={() => void grant()}
          onRefresh={() => void refresh()}
          readiness={readiness}
          showGrant={status?.can_grant === true}
        />
      ) : null}
    </fieldset>
  )
}

function DesktopControlStatus({
  checking,
  copy,
  error,
  granting,
  onGrant,
  onRefresh,
  readiness,
  showGrant
}: {
  checking: boolean
  copy: ComputerCopy
  error: string
  granting: boolean
  onGrant: () => void
  onRefresh: () => void
  readiness: JarvisComputerReadiness
  showGrant: boolean
}) {
  const ready = readiness === 'ready'

  return (
    <div
      className="grid gap-3 rounded-md border border-(--ui-stroke-tertiary) bg-(--ui-bg-tertiary) p-4"
      data-testid="jarvis-computer-status"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-semibold">
          {checking ? (
            <Loader2 className="size-4 animate-spin text-(--ui-accent)" />
          ) : ready ? (
            <Check className="size-4 text-(--ui-green)" />
          ) : (
            <AlertTriangle className="size-4 text-amber-300" />
          )}
          {copy.readiness[readiness]}
        </span>
        <Button className="min-h-11 w-fit" disabled={checking} onClick={onRefresh} type="button" variant="outline">
          <RefreshCw className="size-4" />
          {copy.recheck}
        </Button>
      </div>
      {!ready ? <p className="text-sm leading-6 text-(--ui-text-secondary)">{copy.readinessHint[readiness]}</p> : null}
      {showGrant && !ready ? (
        <Button className="min-h-11 w-fit" disabled={granting} onClick={onGrant} type="button" variant="secondary">
          {granting ? <Loader2 className="size-4 animate-spin" /> : <ExternalLink className="size-4" />}
          {copy.grant}
        </Button>
      ) : null}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
    </div>
  )
}
