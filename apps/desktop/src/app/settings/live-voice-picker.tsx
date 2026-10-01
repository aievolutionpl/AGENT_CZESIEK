import { useRef, useState } from 'react'

import { type LiveVoiceProviderId, previewRealtimeVoice } from '@/api/voice-realtime'
import { useI18n } from '@/i18n'
import { Check, Loader2, Play, Square } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { notifyError } from '@/store/notifications'

import { LIVE_VOICES, type LiveVoice, voiceConfigKey } from '../jarvis/live-voices'

import { getNested } from './helpers'

const COPY = {
  en: {
    character: { female: 'Female', male: 'Male', neutral: 'Neutral' },
    failed: 'Could not play the preview',
    hint: 'Pick by ear: each voice has a short sample. The change applies to the next conversation.',
    play: (name: string) => `Preview the voice ${name}`,
    stop: 'Stop the preview',
    title: 'Czesiek’s voice'
  },
  pl: {
    character: { female: 'Kobiecy', male: 'Męski', neutral: 'Neutralny' },
    failed: 'Nie udało się odtworzyć próbki',
    hint: 'Wybierz na ucho: każdy głos ma krótką próbkę. Zmiana działa od następnej rozmowy.',
    play: (name: string) => `Posłuchaj głosu ${name}`,
    stop: 'Zatrzymaj próbkę',
    title: 'Głos Cześka'
  }
} as const

type Config = Record<string, unknown>

/**
 * The voices of the selected Live provider, male ones first, each with a play button. Choosing writes the
 * provider's own config key; the default (first) voice is what a fresh install speaks with.
 */
export function LiveVoicePicker({
  config,
  onChange
}: {
  config: Config
  onChange: (key: string, value: string) => void
}) {
  const { locale } = useI18n()
  const copy = locale === 'pl' ? COPY.pl : COPY.en
  const provider: LiveVoiceProviderId = getNested(config, 'voice.realtime.provider') === 'openai' ? 'openai' : 'gemini'
  const key = voiceConfigKey(provider)
  const voices = LIVE_VOICES[provider]
  const chosen = String(getNested(config, key) || voices[0].id)
  const [playing, setPlaying] = useState<null | string>(null)
  const [loading, setLoading] = useState<null | string>(null)
  const audio = useRef<HTMLAudioElement | null>(null)
  // A sample is fetched once per voice and kept for the session of this page.
  const cache = useRef(new Map<string, string>())

  const stop = () => {
    audio.current?.pause()
    audio.current = null
    setPlaying(null)
  }

  const play = async (voice: LiveVoice) => {
    const was = playing

    stop()

    if (was === voice.id) {
      return
    }

    setLoading(voice.id)

    try {
      const id = `${provider}:${voice.id}:${locale}`
      let url = cache.current.get(id)

      if (!url) {
        const sample = await previewRealtimeVoice(provider, voice.id, locale === 'pl' ? 'pl' : 'en')
        const bytes = Uint8Array.from(atob(sample.audio), char => char.charCodeAt(0))

        url = URL.createObjectURL(new Blob([bytes], { type: sample.mime }))
        cache.current.set(id, url)
      }

      const element = new Audio(url)

      element.onended = () => setPlaying(current => (current === voice.id ? null : current))
      audio.current = element
      setPlaying(voice.id)
      await element.play()
    } catch (error) {
      setPlaying(null)
      notifyError(error, copy.failed)
    } finally {
      setLoading(null)
    }
  }

  return (
    <section aria-label={copy.title} className="mb-5 grid gap-2" data-testid="live-voice-picker">
      <h3 className="text-sm font-semibold text-(--ui-text-primary)">{copy.title}</h3>
      <p className="text-xs text-(--ui-text-tertiary)">{copy.hint}</p>
      <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {voices.map(voice => {
          const selected = voice.id === chosen

          return (
            <li
              className={cn(
                'jarvis-well flex min-h-12 items-center gap-2 rounded-xl px-2 py-1',
                selected && 'ring-2 ring-(--ui-accent)'
              )}
              key={voice.id}
            >
              <button
                aria-label={playing === voice.id ? copy.stop : copy.play(voice.id)}
                className="grid size-9 shrink-0 place-items-center rounded-full bg-(--ui-accent)/12 text-(--ui-accent) outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-(--ui-accent)"
                onClick={() => void play(voice)}
                type="button"
              >
                {loading === voice.id ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : playing === voice.id ? (
                  <Square className="size-3.5" />
                ) : (
                  <Play className="size-4" />
                )}
              </button>
              <button
                aria-pressed={selected}
                className="flex min-w-0 flex-1 items-center gap-2 rounded-lg py-1 text-left outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-(--ui-accent)"
                onClick={() => onChange(key, voice.id)}
                type="button"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-(--ui-text-primary)">{voice.id}</span>
                  <span className="block truncate text-xs text-(--ui-text-tertiary)">
                    {copy.character[voice.character]} · {voice.feel[locale === 'pl' ? 'pl' : 'en']}
                  </span>
                </span>
                {selected ? <Check className="size-4 shrink-0 text-(--ui-accent)" /> : null}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
