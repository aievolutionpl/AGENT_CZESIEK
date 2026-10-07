import { useStore } from '@nanostores/react'
import { useEffect, useRef, useState } from 'react'

import { useI18n } from '@/i18n'
import { triggerHaptic } from '@/lib/haptics'
import { Mic } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { $character } from '@/store/character'

import { greetingFor } from './characters'
import { JarvisCore } from './core'
import { ScreenLookingBadge } from './screen-looking-badge'
import { $jarvisUi } from './store'
import type { JarvisVoiceState } from './types'
import { useLiveAutostart } from './use-live-autostart'
import { VoiceWave } from './voice-wave'

const FOCUS_RING =
  'outline-none focus-visible:outline focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ui-accent)'

export interface JarvisHomeHeroProps {
  className?: string
  connected: boolean
  listening: boolean
  onStartListening: () => void
  profileDisplayName?: string
}

/**
 * The orb follows backend and microphone state. Action chips fill the composer
 * for review; quick access lives in the rail or here when there is no rail.
 *
 * The hero carries no status line: whatever the orb is doing is already on the
 * orb and in the conversation's own status strip, and a second copy of it under
 * the greeting only competed with the actions.
 */
export function JarvisHomeHero({
  className,
  connected,
  listening,
  onStartListening,
  profileDisplayName
}: JarvisHomeHeroProps) {
  useLiveAutostart(connected)
  const { t } = useI18n()
  const copy = t.jarvisShell.home
  const state = useStore($jarvisUi)
  // "default" is the machine's unnamed profile, not a person: greet without it.
  const rawName = profileDisplayName?.trim()
  const name = rawName && rawName.toLowerCase() !== 'default' ? rawName : undefined
  const character = useStore($character)
  const greeting = greetingFor(character, new Date(), copy.greetings)
  // The conversation owns the orb's voice state (`publishJarvisVoiceState`):
  // Live voice reports listening/speaking from the renderer, so masking the
  // state with `listening` would freeze the orb while Gemini actually speaks.
  // The fallback still shows a just-opened conversation as listening.
  const orbVoice: JarvisVoiceState = listening && state.voice === 'idle' ? 'listening' : state.voice
  // One microphone on the screen at a time. The dashboard's voice dock (the
  // pill with the meter, the mute and the end-conversation button) appears the
  // moment this conversation is live — so the hero's own talk button stands
  // down then, instead of putting a second microphone control beside it.
  const frameRef = useRef<HTMLDivElement>(null)
  const [availableHeight, setAvailableHeight] = useState<number | null>(null)
  // The transcript shares its bottom edge with an overlaid composer. Measure the
  // usable frame so the hero cannot push its actions underneath that composer.

  useEffect(() => {
    const root = frameRef.current
    const frame = root?.closest('[data-chat-transcript-frame]')

    if (!root || !frame || typeof ResizeObserver === 'undefined') {
      return
    }

    const composer =
      frame.parentElement?.querySelector('[data-slot="composer-root"]') ?? frame.parentElement?.querySelector('form')

    const measure = () => {
      const bounds = frame.getBoundingClientRect()
      const composerBounds = composer?.getBoundingClientRect()
      const overlap = composerBounds ? Math.max(0, bounds.bottom - composerBounds.top) : 52
      setAvailableHeight(Math.max(180, bounds.height - overlap))
    }

    const observer = new ResizeObserver(measure)
    observer.observe(frame)

    if (composer) {
      observer.observe(composer)
    }

    measure()

    return () => observer.disconnect()
  }, [])

  return (
    // Laid out by the chat column's width, not the window's: the sidebar, the
    // rail and a split pane all eat into it.
    <div
      className="@container flex w-full justify-center"
      ref={frameRef}
      style={
        availableHeight
          ? ({ height: availableHeight, '--jarvis-available-height': `${availableHeight}px` } as React.CSSProperties)
          : undefined
      }
    >
      <section
        aria-labelledby="jarvis-home-title"
        className={cn(
          'jarvis-home relative flex h-full w-full max-w-4xl flex-col items-center justify-center gap-2 px-3 pt-3 pb-8 text-center [--jarvis-hero-size:min(340px,max(140px,calc(var(--jarvis-available-height,500px)_-_230px)),88cqw)] @2xl:[--jarvis-hero-size:min(560px,max(200px,calc(var(--jarvis-available-height,650px)_-_210px)),74cqw)]',
          className
        )}
        data-testid="jarvis-home-hero"
      >
        {listening ? null : (
          <div className="jarvis-home__caption flex flex-col items-center gap-2 rounded-2xl px-5 py-3">
            <h1
              className="text-2xl font-semibold leading-tight tracking-tight text-(--ui-text-primary) @2xl:text-3xl"
              id="jarvis-home-title"
            >
              {name ? `${name}, ${greeting.charAt(0).toLowerCase()}${greeting.slice(1)}` : greeting}
            </h1>
            <p className="text-base text-(--ui-text-secondary) @2xl:text-lg">{copy.subtitle}</p>
          </div>
        )}

        <div className="jarvis-home__orb relative my-2 grid w-(--jarvis-hero-size) max-w-full shrink-0 place-items-center">
          <JarvisCore live taskPhase={state.task.phase} variant="hero" voice={orbVoice} />
        </div>
        {listening ? <VoiceWave active={orbVoice === 'listening' || orbVoice === 'speaking'} /> : null}
        <ScreenLookingBadge />

        {/* One primary action. Briefing and the
            floating-orb switch live in the command palette and settings. */}
        {/* While the conversation is live the screen is just the orb and the dock below. */}
        {listening ? null : (
          <div className="jarvis-home__cta flex flex-col items-center gap-3">
            <button
              className={cn('jarvis-action jarvis-action--talk', FOCUS_RING)}
              disabled={!connected}
              onClick={() => {
                triggerHaptic('open')
                onStartListening()
              }}
              type="button"
            >
              <Mic />
              {copy.talk}
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
