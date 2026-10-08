/**
 * What the tips window remembers.
 *
 * Scoped exactly like onboarding (connection + profile), because "I know what
 * this Jarvis can do" is a fact about one backend and one profile, not about
 * the app. Same storage discipline too: every read and write is wrapped, a
 * corrupt or unreadable payload reads as "nothing stored", and the panel is
 * fully usable when storage is denied — it just forgets.
 *
 * `autoOpen` is the only nag switch in here and it has exactly one job: the
 * window shows itself ONCE, after setup, and then never again on its own. Any
 * further opening is a button the user pressed.
 */

import {
  currentJarvisOnboardingScope,
  type JarvisOnboardingScope,
  normalizeJarvisOnboardingScope
} from './onboarding-state'

export const JARVIS_TIPS_VERSION = 1
export const JARVIS_TIPS_STATE_KEY = 'ai-evolution-jarvis-tips-v1'

export interface JarvisTipsState {
  /** Still allowed to open itself. Cleared the first time it does. */
  autoOpen: boolean
  dismissedIds: string[]
  version: number
}

export function initialJarvisTipsState(): JarvisTipsState {
  return { autoOpen: true, dismissedIds: [], version: JARVIS_TIPS_VERSION }
}

export function jarvisTipsStorageKey(scope: JarvisOnboardingScope = currentJarvisOnboardingScope()): string {
  const normalized = normalizeJarvisOnboardingScope(scope)
  const suffix = `${encodeURIComponent(normalized.connectionId)}::${encodeURIComponent(normalized.profile)}`

  return `${JARVIS_TIPS_STATE_KEY}:${suffix}`
}

export function sanitizeJarvisTipsState(state: Partial<JarvisTipsState> | null | undefined): JarvisTipsState {
  const dismissedIds = Array.isArray(state?.dismissedIds)
    ? Array.from(new Set(state.dismissedIds.filter((id): id is string => typeof id === 'string' && id.trim() !== '')))
    : []

  return {
    autoOpen: state?.autoOpen !== false,
    dismissedIds,
    version: JARVIS_TIPS_VERSION
  }
}

export function parseJarvisTipsState(raw: null | string): JarvisTipsState | null {
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as Partial<JarvisTipsState>

    return parsed.version === JARVIS_TIPS_VERSION ? sanitizeJarvisTipsState(parsed) : null
  } catch {
    return null
  }
}

export function readJarvisTipsState(
  storage: Storage | undefined = globalThis.localStorage,
  scope: JarvisOnboardingScope = currentJarvisOnboardingScope()
): JarvisTipsState {
  if (!storage) {
    return initialJarvisTipsState()
  }

  try {
    return parseJarvisTipsState(storage.getItem(jarvisTipsStorageKey(scope))) ?? initialJarvisTipsState()
  } catch {
    return initialJarvisTipsState()
  }
}

export function writeJarvisTipsState(
  state: JarvisTipsState,
  storage: Storage | undefined = globalThis.localStorage,
  scope: JarvisOnboardingScope = currentJarvisOnboardingScope()
): boolean {
  if (!storage) {
    return false
  }

  try {
    storage.setItem(jarvisTipsStorageKey(scope), JSON.stringify(sanitizeJarvisTipsState(state)))

    return true
  } catch {
    return false
  }
}

export interface JarvisTipsAutoOpenInput {
  /** A turn in flight is not a moment to pop a window over the work. */
  busy?: boolean
  onboardingComplete: boolean
  state: JarvisTipsState
}

/**
 * Whether the window may show itself right now.
 *
 * Setup has to be finished (mid-wizard the onboarding dialog owns the screen),
 * nothing may be running, and the one auto-open this scope is entitled to must
 * still be unspent.
 */
export function shouldAutoOpenJarvisTips({
  busy = false,
  onboardingComplete,
  state
}: JarvisTipsAutoOpenInput): boolean {
  return onboardingComplete && !busy && state.autoOpen
}

export function dismissJarvisTip(state: JarvisTipsState, id: string): JarvisTipsState {
  return state.dismissedIds.includes(id) ? state : { ...state, dismissedIds: [...state.dismissedIds, id] }
}

/** Bring back every tip this scope waved away — the "pokaż wszystkie
 *  podpowiedzi" escape hatch. The spent auto-open stays spent: asking to see
 *  the hidden tips is not asking to be interrupted again later. */
export function resetJarvisTips(state: JarvisTipsState): JarvisTipsState {
  return { ...state, dismissedIds: [] }
}
