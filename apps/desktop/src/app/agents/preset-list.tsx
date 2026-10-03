import { useState } from 'react'
import { useNavigate } from 'react-router'

import { NEW_CHAT_ROUTE } from '@/app/routes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import { CharacterAvatar } from './character-avatar'
import { preparePresetTask } from './launch-preset'
import type { PresetOwner } from './preset-store'
import { skillAvailability, type SubagentPreset } from './presets'

interface PresetListProps {
  owner: PresetOwner
  presets: readonly SubagentPreset[]
  skills: readonly { name: string; enabled: boolean }[]
  onEdit: (preset: SubagentPreset) => void
}

export function PresetList({ owner, presets, skills, onEdit }: PresetListProps) {
  const navigate = useNavigate()
  const [tasks, setTasks] = useState<Record<string, string>>({})
  const [search, setSearch] = useState('')
  const [department, setDepartment] = useState('Wszystkie')
  const departments = ['Wszystkie', ...new Set(presets.map(item => item.department || 'Pozostałe'))]

  const filtered = presets.filter(
    preset =>
      (department === 'Wszystkie' || (preset.department || 'Pozostałe') === department) &&
      `${preset.name} ${preset.character}`.toLocaleLowerCase('pl').includes(search.toLocaleLowerCase('pl'))
  )

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          aria-label="Szukaj agenta"
          onChange={event => setSearch(event.target.value)}
          placeholder="Znajdź osobę lub specjalizację…"
          value={search}
        />
        <label className="flex items-center gap-2 text-sm">
          Dział
          <select
            className="jarvis-choice min-h-10 rounded-lg px-3"
            onChange={event => setDepartment(event.target.value)}
            value={department}
          >
            {departments.map(item => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <span className="text-xs text-muted-foreground">{filtered.length} ról</span>
      </div>
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nie ma takiej roli. Zmień filtr albo utwórz własnego agenta.</p>
      ) : null}
      <div className="grid gap-4 @xl:grid-cols-2">
        {filtered.map(preset => {
          const states = skillAvailability(preset.skills, skills)
          const unavailable = states.some(item => item.state !== 'enabled')

          return (
            <article className="office-agent-card grid content-start gap-3 p-4" key={preset.id}>
              <div className="flex items-center gap-3">
                <CharacterAvatar avatar={preset.avatar} name={preset.name} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">{preset.department || 'Twój zespół'}</p>
                  <h3 className="text-base font-semibold">{preset.name}</h3>
                </div>
                <Button onClick={() => onEdit(preset)} size="xs" variant="ghost">
                  Edytuj
                </Button>
              </div>
              <details className="text-sm leading-relaxed text-muted-foreground">
                <summary className="cursor-pointer">Charakter i sposób pracy</summary>
                <p className="mt-2">{preset.character}</p>
              </details>
              {preset.skills.length ? (
                <p className="text-xs text-muted-foreground">
                  Skille:{' '}
                  {states.map(item => `${item.name}${item.state !== 'enabled' ? ' (niedostępny)' : ''}`).join(', ')}
                </p>
              ) : null}
              {unavailable ? (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Włącz wymagane skille w Narzędziach lub edytuj rolę. Zadanie może korzystać tylko z dostępnych
                  umiejętności.
                </p>
              ) : null}
              {preset.exampleTask ? (
                <Button
                  className="justify-self-start"
                  onClick={() => setTasks(current => ({ ...current, [preset.id]: preset.exampleTask! }))}
                  size="xs"
                  variant="text"
                >
                  Wstaw przykładowe zadanie
                </Button>
              ) : null}
              <form
                className="grid gap-2"
                onSubmit={event => {
                  event.preventDefault()
                  const task = tasks[preset.id]?.trim()

                  if (!task) {
                    return
                  }

                  preparePresetTask(owner, preset, task, states)
                  navigate(NEW_CHAT_ROUTE)
                }}
              >
                <Input
                  aria-label={`Zadanie dla ${preset.name}`}
                  onChange={event => setTasks(current => ({ ...current, [preset.id]: event.target.value }))}
                  placeholder="Co chcesz zlecić?"
                  value={tasks[preset.id] ?? ''}
                />
                <Button disabled={!tasks[preset.id]?.trim()} size="sm" type="submit">
                  Przygotuj zadanie
                </Button>
              </form>
              <p className="text-xs text-muted-foreground">
                Sprawdzisz treść w rozmowie przed wysłaniem. Czesiek koordynuje pracę.
              </p>
            </article>
          )
        })}
      </div>
    </section>
  )
}
