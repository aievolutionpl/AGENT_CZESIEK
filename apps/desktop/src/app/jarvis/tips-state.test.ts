import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  dismissJarvisTip,
  initialJarvisTipsState,
  jarvisTipsStorageKey,
  readJarvisTipsState,
  resetJarvisTips,
  shouldAutoOpenJarvisTips,
  writeJarvisTipsState
} from './tips-state'

const SCOPE = { connectionId: 'local', profile: 'default' }
const OTHER_SCOPE = { connectionId: 'local', profile: 'research' }

afterEach(() => {
  window.localStorage.clear()
  vi.restoreAllMocks()
})

describe('jarvis tips state', () => {
  it('remembers hidden tips per connection and profile', () => {
    writeJarvisTipsState(dismissJarvisTip(initialJarvisTipsState(), 'web.research'), window.localStorage, SCOPE)

    expect(readJarvisTipsState(window.localStorage, SCOPE).dismissedIds).toEqual(['web.research'])
    expect(readJarvisTipsState(window.localStorage, OTHER_SCOPE).dismissedIds).toEqual([])
  })

  it('reads a corrupt payload as nothing stored instead of throwing', () => {
    window.localStorage.setItem(jarvisTipsStorageKey(SCOPE), '{not json')

    expect(readJarvisTipsState(window.localStorage, SCOPE)).toEqual(initialJarvisTipsState())
  })

  it('stays usable when storage refuses the write', () => {
    // The Node 26 test shim is an in-memory Storage object, not a jsdom
    // Storage instance. Inject the failing boundary instead of its prototype.
    const blocked = {
      setItem: () => {
        throw new Error('quota')
      }
    } as unknown as Storage

    expect(writeJarvisTipsState(initialJarvisTipsState(), blocked, SCOPE)).toBe(false)
  })

  it('restores hidden tips without re-arming the one automatic appearance', () => {
    const spent = { ...dismissJarvisTip(initialJarvisTipsState(), 'web.research'), autoOpen: false }
    const restored = resetJarvisTips(spent)

    expect(restored.dismissedIds).toEqual([])
    expect(restored.autoOpen).toBe(false)
  })
})

describe('shouldAutoOpenAgent CzesiekTips', () => {
  it('opens once, only after setup, and never over work in flight', () => {
    const fresh = initialJarvisTipsState()

    expect(shouldAutoOpenJarvisTips({ onboardingComplete: true, state: fresh })).toBe(true)
    expect(shouldAutoOpenJarvisTips({ onboardingComplete: false, state: fresh })).toBe(false)
    expect(shouldAutoOpenJarvisTips({ busy: true, onboardingComplete: true, state: fresh })).toBe(false)
    expect(shouldAutoOpenJarvisTips({ onboardingComplete: true, state: { ...fresh, autoOpen: false } })).toBe(false)
  })
})
