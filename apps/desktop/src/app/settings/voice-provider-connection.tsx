import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'

import type { ProfileScope } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useI18n } from '@/i18n'
import { AudioLines, Check, ExternalLink } from '@/lib/icons'

import { useEnvCredentials } from './env-credentials'
import { VOICE_PROVIDER_KEYS, type VoiceProviderChoice } from './voice-provider-choice'

const KEY_PAGES = {
  gemini: 'https://aistudio.google.com/app/apikey',
  openai: 'https://platform.openai.com/api-keys',
  elevenlabs: 'https://elevenlabs.io/app/settings/api-keys'
} as const

const PROVIDERS = [
  { id: 'gemini', name: 'Gemini Live', pl: 'Naturalna rozmowa na żywo', en: 'Natural live conversation' },
  {
    id: 'openai',
    name: 'OpenAI Realtime',
    pl: 'Rozmowa na żywo przez OpenAI API',
    en: 'Live conversation with OpenAI API'
  },
  { id: 'elevenlabs', name: 'ElevenLabs', pl: 'Głosy do odpowiedzi Cześka', en: 'Voices for Czesiek’s replies' }
] as const

export function VoiceProviderConnection({
  provider,
  onChange,
  scope
}: {
  provider: VoiceProviderChoice
  onChange: (provider: VoiceProviderChoice) => void
  scope: ProfileScope
}) {
  const { locale } = useI18n()
  const pl = locale === 'pl'
  const { vars, saveValue } = useEnvCredentials(scope)
  const queryClient = useQueryClient()
  const [key, setKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const envKey = VOICE_PROVIDER_KEYS[provider]

  const stored =
    vars?.[envKey]?.is_set ||
    (provider === 'gemini' && vars?.GOOGLE_API_KEY?.is_set) ||
    (provider === 'openai' && vars?.OPENAI_API_KEY?.is_set)

  async function save() {
    setSaving(true)
    setMessage('')

    try {
      const result = await saveValue(envKey, key.trim())

      if (result.ok) {
        setKey('')
        setMessage(
          pl
            ? 'Klucz zapisany. Wybierz głos i rozpocznij nową rozmowę.'
            : 'Key saved. Choose a voice and start a new conversation.'
        )
        // Voice catalogs and availability may have been fetched before the key existed.
        await queryClient.invalidateQueries({ queryKey: ['elevenlabs-voices'] })
      } else {
        setMessage(result.message ?? (pl ? 'Nie udało się zapisać klucza.' : 'Could not save the key.'))
      }
    } catch {
      setMessage(
        pl
          ? 'Nie udało się zapisać klucza. Sprawdź połączenie z silnikiem.'
          : 'Could not save the key. Check the engine connection.'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <section aria-label={pl ? 'Dostawca głosu' : 'Voice provider'} className="grid gap-4">
      <div>
        <h3 className="text-base font-semibold">
          {pl ? '1. Wybierz dostawcę głosu' : '1. Choose your voice provider'}
        </h3>
        <p className="mt-1 text-sm text-(--ui-text-secondary)">
          {pl
            ? 'Dostawca rozmowy jest niezależny od modelu, który wykonuje zadania.'
            : 'The conversation provider is independent of the model that performs tasks.'}
        </p>
      </div>
      <div
        aria-label={pl ? 'Dostawcy rozmowy' : 'Conversation providers'}
        className="grid gap-2 sm:grid-cols-3"
        role="group"
      >
        {PROVIDERS.map(item => (
          <button
            aria-pressed={provider === item.id}
            className={`jarvis-well min-h-20 rounded-xl border p-3 text-left transition-colors hover:bg-(--ui-bg-tertiary) focus-visible:outline-2 focus-visible:outline-(--ui-accent) ${provider === item.id ? 'border-(--ui-accent) bg-(--ui-accent)/5' : 'border-(--ui-stroke-tertiary)'}`}
            key={item.id}
            onClick={() => onChange(item.id)}
            type="button"
          >
            <span className="flex items-center gap-2 text-sm font-semibold">
              <AudioLines aria-hidden="true" className="size-4 shrink-0 text-(--ui-accent)" />
              {item.name}
              {provider === item.id && (
                <Check aria-hidden="true" className="ml-auto size-4 shrink-0 text-(--ui-accent)" />
              )}
            </span>
            <span className="mt-1 block text-xs text-(--ui-text-secondary)">{pl ? item.pl : item.en}</span>
          </button>
        ))}
      </div>
      <div className="jarvis-well grid gap-3 rounded-xl border border-(--ui-stroke-tertiary) p-4">
        <h4 className="text-sm font-semibold">{pl ? '2. Podłącz swój klucz API' : '2. Connect your API key'}</h4>
        <p className="text-sm text-(--ui-text-secondary)" role="status">
          {vars === null
            ? pl
              ? 'Sprawdzam zapisane klucze…'
              : 'Checking saved keys…'
            : stored
              ? pl
                ? 'Klucz zapisany w tym profilu. Możesz go zastąpić poniżej.'
                : 'Key saved in this profile. You can replace it below.'
              : pl
                ? 'Dodaj klucz dostawcy, aby korzystać z jego głosów.'
                : 'Add the provider’s key to use its voices.'}
        </p>
        <Button
          className="w-fit"
          onClick={() => {
            const url = KEY_PAGES[provider]

            if (window.hermesDesktop?.openExternal) {
              void window.hermesDesktop
                .openExternal(url)
                .catch(() =>
                  setMessage(pl ? 'Nie otwarto przeglądarki. Adres: ' + url : 'Could not open browser. URL: ' + url)
                )
            } else {
              window.open(url, '_blank', 'noopener,noreferrer')
            }
          }}
          size="sm"
          type="button"
          variant="ghost"
        >
          <ExternalLink aria-hidden="true" className="size-4" />
          {pl ? 'Uzyskaj klucz u dostawcy' : 'Get a key from the provider'}
        </Button>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={event => {
            event.preventDefault()
            void save()
          }}
        >
          <label className="min-w-48 flex-1">
            <span className="sr-only">{pl ? 'Klucz API dostawcy głosu' : 'Voice provider API key'}</span>
            <Input
              autoComplete="off"
              disabled={saving}
              onChange={event => setKey(event.target.value)}
              placeholder={envKey}
              spellCheck={false}
              type="password"
              value={key}
            />
          </label>
          <Button disabled={saving || !key.trim()} type="submit">
            {saving ? (pl ? 'Zapisuję…' : 'Saving…') : pl ? 'Zapisz klucz' : 'Save key'}
          </Button>
        </form>
        <p className="text-xs text-(--ui-text-secondary)">
          {pl
            ? 'Klucz trafia do ustawień wybranego profilu silnika, nie do kodu ani GitHuba. Opłaty za API rozlicza dostawca.'
            : 'The key is saved in the selected engine profile, never in source code or GitHub. API usage is billed by the provider.'}
        </p>
        {message && (
          <p className="text-sm" role="status">
            {message}
          </p>
        )}
        {provider === 'elevenlabs' && (
          <p className="text-sm text-(--ui-text-secondary)">
            {pl
              ? 'ElevenLabs czyta odpowiedzi Cześka. Mikrofon korzysta z rozpoznawania mowy ustawionego poniżej — to nie jest osobny agent ElevenLabs.'
              : 'ElevenLabs reads Czesiek’s replies. The microphone uses the speech recognition configured below; this is not a separate ElevenLabs agent.'}
          </p>
        )}
        {provider === 'openai' && (
          <div className="grid gap-2 text-sm text-(--ui-text-secondary)">
            <p>
              {pl
                ? 'Subskrypcja ChatGPT i OpenAI API to oddzielne usługi. Logowanie ChatGPT do zadań nie zastępuje klucza API potrzebnego do rozmowy Realtime.'
                : 'ChatGPT subscriptions and OpenAI API are separate services. ChatGPT login for tasks does not replace the API key required for Realtime conversation.'}
            </p>
            <Link className="w-fit underline" to="/settings?tab=providers">
              {pl ? 'Podłącz ChatGPT do wykonywania zadań' : 'Connect ChatGPT for tasks'}
            </Link>
          </div>
        )}
        <Link className="w-fit text-sm underline" to="/settings?tab=health">
          {pl
            ? 'Sprawdź mikrofon i rozmowę w „Czy wszystko działa?”'
            : 'Check microphone and conversation in assistant health'}
        </Link>
      </div>
      <h3 className="text-base font-semibold">
        {pl ? '3. Wybierz głos i posłuchaj próbki' : '3. Choose a voice and listen to a sample'}
      </h3>
    </section>
  )
}
