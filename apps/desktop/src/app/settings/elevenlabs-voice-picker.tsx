import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'

import { type ProfileScope, profileScopeKey } from '@/api/client'
import { previewElevenLabsVoice } from '@/api/elevenlabs'
import { getElevenLabsVoices } from '@/api/system'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useI18n } from '@/i18n'
import { Check, Loader2, Play, Square } from '@/lib/icons'
import { cn } from '@/lib/utils'

import { useVoicePreview } from './use-voice-preview'

export function ElevenLabsVoicePicker({
  chosen,
  onChange,
  scope
}: {
  chosen: string
  onChange: (voice: string) => void
  scope: ProfileScope
}) {
  const { locale } = useI18n()
  const pl = locale === 'pl'
  const [search, setSearch] = useState('')

  const voices = useQuery({
    queryKey: ['elevenlabs-voices', profileScopeKey(scope)],
    queryFn: () => getElevenLabsVoices(scope),
    retry: false
  })

  const { loading, play, playing, stop } = useVoicePreview(
    `${profileScopeKey(scope)}:${locale}:${chosen}`,
    pl ? 'Nie udało się odtworzyć próbki ElevenLabs' : 'Could not play the ElevenLabs sample'
  )

  const rows =
    voices.data?.voices.filter(voice => voice.label.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())) ??
    []

  const error = voices.data?.error

  const notice = voices.isError
    ? pl
      ? 'Nie udało się połączyć z ElevenLabs. Spróbuj ponownie.'
      : 'Could not connect to ElevenLabs. Try again.'
    : error === 'unauthorized'
      ? pl
        ? 'Klucz ElevenLabs został odrzucony. Sprawdź klucz i jego uprawnienia.'
        : 'ElevenLabs rejected the key. Check its permissions.'
      : error === 'rate_limit'
        ? pl
          ? 'Limit ElevenLabs. Spróbuj ponownie za chwilę.'
          : 'ElevenLabs rate limit. Try again later.'
        : pl
          ? 'Dodaj swój klucz ElevenLabs w ustawieniach kluczy API.'
          : 'Add your ElevenLabs API key in API key settings.'

  return (
    <section aria-label="ElevenLabs" className="grid gap-3">
      <h3 className="text-base font-semibold">ElevenLabs</h3>
      <p className="text-sm text-(--ui-text-secondary)">
        {pl
          ? 'Głos czytania odpowiedzi. Rozmowa Gemini Live nadal używa własnego głosu. Wybór zapisuje się automatycznie i działa od następnej odpowiedzi.'
          : 'Read-aloud voice. Gemini Live keeps its own voice. Your choice is saved automatically and applies to the next reply.'}
      </p>
      {voices.isPending ? (
        <p role="status">{pl ? 'Wczytuję głosy konta…' : 'Loading account voices…'}</p>
      ) : !voices.data?.available ? (
        <div className="jarvis-well grid gap-2 p-3" role="status">
          <p>{notice}</p>
          <Link className="underline" to="/settings?tab=keys">
            {pl ? 'Klucze API' : 'API keys'}
          </Link>
          <Button onClick={() => void voices.refetch()} size="sm" variant="secondary">
            {pl ? 'Spróbuj ponownie' : 'Try again'}
          </Button>
        </div>
      ) : (
        <>
          <Input
            aria-label={pl ? 'Szukaj głosu ElevenLabs' : 'Search ElevenLabs voices'}
            onChange={event => setSearch(event.target.value)}
            placeholder={pl ? 'Szukaj głosu…' : 'Search voices…'}
            value={search}
          />
          {rows.length === 0 ? <p>{pl ? 'Brak głosów pasujących do wyszukiwania.' : 'No matching voices.'}</p> : null}
          <ul className="grid max-h-80 gap-2 overflow-y-auto sm:grid-cols-2">
            {rows.map(voice => (
              <li
                className={cn(
                  'jarvis-well flex min-h-12 items-center gap-2 p-2',
                  voice.voice_id === chosen && 'ring-2 ring-(--ui-accent)'
                )}
                key={voice.voice_id}
              >
                <Button
                  aria-label={
                    playing === voice.voice_id
                      ? pl
                        ? 'Zatrzymaj próbkę'
                        : 'Stop preview'
                      : pl
                        ? `Posłuchaj ${voice.name}`
                        : `Preview ${voice.name}`
                  }
                  onClick={() =>
                    void play(voice.voice_id, () => previewElevenLabsVoice(voice.voice_id, pl ? 'pl' : 'en', scope))
                  }
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  {loading === voice.voice_id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : playing === voice.voice_id ? (
                    <Square className="size-4" />
                  ) : (
                    <Play className="size-4" />
                  )}
                </Button>
                <button
                  aria-pressed={voice.voice_id === chosen}
                  className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg p-1 text-left text-sm focus-visible:outline-2"
                  onClick={() => {
                    stop()
                    onChange(voice.voice_id)
                  }}
                  type="button"
                >
                  <span className="truncate">{voice.label}</span>
                  {voice.voice_id === chosen ? <Check className="size-4 shrink-0" /> : null}
                </button>
              </li>
            ))}
          </ul>
          <p className="text-xs text-(--ui-text-secondary)">
            {pl
              ? 'Odsłuch korzysta z API ElevenLabs i może zużywać limit konta.'
              : 'Previews use the ElevenLabs API and may consume account credits.'}
          </p>
        </>
      )}
    </section>
  )
}
