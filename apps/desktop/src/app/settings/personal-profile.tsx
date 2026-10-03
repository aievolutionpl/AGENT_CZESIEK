import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { getHermesConfigRecord, saveHermesConfigRecord } from '@/hermes'
import { useActiveCapabilityScope } from '@/hooks/use-active-capability-scope'

import { hermesConfigCacheWriter, useHermesConfigRecord } from '../hooks/use-config-record'
import { PersonalityStep } from '../jarvis/onboarding-personality'
import { type CzesiekPersonality, normalizePersonality, withPersonality } from '../jarvis/personality'

import { getNested, setNested } from './helpers'

export function PersonalProfileSettings() {
  const { scope, scopeKey } = useActiveCapabilityScope()

  return <PersonalProfileEditor key={scopeKey} scope={scope} />
}

interface PersonalProfileEditorProps {
  scope: ReturnType<typeof useActiveCapabilityScope>['scope']
}

function PersonalProfileEditor({ scope }: PersonalProfileEditorProps) {
  const query = useHermesConfigRecord(scope)
  const [draft, setDraft] = useState<CzesiekPersonality | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const alive = useRef(true)
  // eslint-disable-next-line no-restricted-syntax -- lifecycle liveness only; no reactive atom is mirrored
  useEffect(() => {
    alive.current = true

    return () => {
      alive.current = false
    }
  }, [])
  const value = draft ?? normalizePersonality(query.data ? getNested(query.data, 'display.czesiek_profile') : undefined)

  const save = async () => {
    setSaving(true)
    setMessage('')

    try {
      // Read the current record so unrelated settings changed elsewhere survive.
      const config = await getHermesConfigRecord(scope)

      if (!alive.current) {
        return
      }

      const next = setNested(
        setNested(config, 'display.czesiek_profile', value),
        'custom_prompt',
        withPersonality(config.custom_prompt, value)
      )

      const result = await saveHermesConfigRecord(next, scope)

      if (!result.ok) {
        throw new Error('Nie udało się zapisać profilu. Spróbuj ponownie.')
      }

      hermesConfigCacheWriter(scope)(next)

      if (alive.current) {
        setDraft(null)
        setMessage('Zapisano. Nowy styl pracy zostanie użyty w nowej rozmowie.')
      }
    } catch (error) {
      if (alive.current) {
        setMessage(error instanceof Error ? error.message : 'Nie udało się zapisać profilu.')
      }
    } finally {
      if (alive.current) {
        setSaving(false)
      }
    }
  }

  return (
    <section aria-labelledby="personal-profile-title" className="jarvis-panel my-6 grid gap-4 p-5">
      <div>
        <h2 className="text-lg font-semibold" id="personal-profile-title">
          Twój profil i styl współpracy
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Jak Czesiek ma się do Ciebie zwracać, w czym pomagać i jak rozmawiać? Te ustawienia dotyczą tylko tego
          profilu. Zmiana nie przerywa trwającej rozmowy.
        </p>
      </div>
      {query.isError ? (
        <div role="alert">
          <p className="text-sm text-destructive">Nie można wczytać profilu.</p>
          <Button onClick={() => void query.refetch()} size="sm" variant="ghost">
            Spróbuj ponownie
          </Button>
        </div>
      ) : query.data ? (
        <fieldset className="grid gap-4" disabled={saving}>
          <PersonalityStep onChange={setDraft} value={value} />
          <div className="flex gap-2">
            <Button disabled={!draft || saving} onClick={() => void save()} size="sm">
              {saving ? 'Zapisywanie…' : 'Zapisz profil'}
            </Button>
            <Button
              disabled={!draft || saving}
              onClick={() => {
                setDraft(null)
                setMessage('')
              }}
              size="sm"
              variant="ghost"
            >
              Cofnij zmiany
            </Button>
          </div>
        </fieldset>
      ) : (
        <p className="text-sm text-muted-foreground">Wczytywanie profilu…</p>
      )}
      {message ? (
        <p className="text-sm" role="status">
          {message}
        </p>
      ) : null}
    </section>
  )
}
