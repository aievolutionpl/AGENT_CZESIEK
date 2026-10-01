import { useStore } from '@nanostores/react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'
import { triggerHaptic } from '@/lib/haptics'
import { Loader2, Mic, MicOff, Square, Volume2, VolumeX } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { $speakerMuted, toggleSpeakerMuted } from '@/store/voice-output'

type VoiceAction = () => Promise<void> | void

export interface VoiceControlsProps {
  disabled?: boolean
  error?: null | string
  listening: boolean
  loading?: boolean
  /** True while the microphone is switched off inside a running conversation. */
  muted?: boolean
  speaking: boolean
  startListening: VoiceAction
  stopListening: VoiceAction
  /** Cuts off speech that is playing right now (the classic, non-Live voice). */
  stopPlayback: VoiceAction
  /** Omitted when the conversation's microphone cannot be switched off. */
  toggleMute?: VoiceAction
}

const COPY = {
  en: {
    end: 'End conversation',
    label: 'Voice controls',
    micOff: 'Turn the microphone off',
    micOn: 'Turn the microphone on',
    mute: 'Mute the voice',
    start: 'Start talking',
    unmute: 'Unmute the voice'
  },
  pl: {
    end: 'Zakończ rozmowę',
    label: 'Sterowanie głosem',
    micOff: 'Wyłącz mikrofon',
    micOn: 'Włącz mikrofon',
    mute: 'Wycisz głos',
    start: 'Zacznij rozmowę',
    unmute: 'Włącz głos'
  }
} as const

/**
 * The conversation's voice dock, reduced to what a live conversation needs: the microphone's switch
 * (only while live), silence for the assistant's voice, and end (or start) the conversation. The level of the voice is drawn by the ring
 * round the orb (`voice-aura.tsx`), so nothing else belongs here.
 */
export function VoiceControls({
  disabled = false,
  error = null,
  listening,
  loading = false,
  muted = false,
  speaking,
  startListening,
  stopListening,
  stopPlayback,
  toggleMute
}: VoiceControlsProps) {
  const { locale } = useI18n()
  const copy = locale === 'pl' ? COPY.pl : COPY.en
  const speakerMuted = useStore($speakerMuted)
  const [pending, setPending] = useState(false)
  const busy = loading || pending
  const iconButton = 'jarvis-icon-btn size-10 min-h-10 min-w-10 rounded-full'

  const toggleSpeaker = () => {
    triggerHaptic('tap')
    toggleSpeakerMuted()

    // Speech already playing is cut off when the voice is muted; Live sessions mute their own audio.
    if (!speakerMuted && speaking) {
      void stopPlayback()
    }
  }

  const toggleConversation = async () => {
    if (disabled || busy) {
      return
    }

    triggerHaptic(listening ? 'close' : 'open')
    setPending(true)

    try {
      await (listening ? stopListening() : startListening())
    } finally {
      setPending(false)
    }
  }

  const speakerLabel = speakerMuted ? copy.unmute : copy.mute
  const conversationLabel = listening ? copy.end : copy.start

  return (
    <section
      aria-label={copy.label}
      className="jarvis-voice-dock mx-auto flex w-fit max-w-full items-center gap-1"
      data-testid="jarvis-voice-controls"
    >
      {toggleMute && listening ? (
        <Button
          aria-label={muted ? copy.micOn : copy.micOff}
          aria-pressed={muted}
          className={cn(iconButton, muted && 'jarvis-icon-btn--live')}
          disabled={disabled}
          onClick={() => {
            triggerHaptic('tap')
            void toggleMute()
          }}
          size="icon"
          title={muted ? copy.micOn : copy.micOff}
          type="button"
        >
          {muted ? <MicOff /> : <Mic />}
        </Button>
      ) : null}

      <Button
        aria-label={speakerLabel}
        aria-pressed={speakerMuted}
        className={cn(iconButton, speakerMuted && 'jarvis-icon-btn--live')}
        disabled={disabled}
        onClick={toggleSpeaker}
        size="icon"
        title={speakerLabel}
        type="button"
      >
        {speakerMuted ? <VolumeX /> : <Volume2 />}
      </Button>

      <Button
        aria-label={conversationLabel}
        aria-pressed={listening}
        className={cn(iconButton, listening && 'jarvis-icon-btn--danger')}
        disabled={disabled || busy}
        onClick={() => void toggleConversation()}
        size="icon"
        title={conversationLabel}
        type="button"
      >
        {pending ? <Loader2 className="animate-spin" /> : listening ? <Square /> : <Mic />}
      </Button>

      {error ? (
        <p className="sr-only" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  )
}
