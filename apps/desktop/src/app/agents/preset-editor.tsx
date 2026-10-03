import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import { CHARACTER_AVATARS, CharacterAvatar } from './character-avatar'
import type { SubagentPreset } from './presets'

export function PresetEditor({
  preset,
  onCancel,
  onSave
}: {
  preset: SubagentPreset | null
  onCancel: () => void
  onSave: (preset: SubagentPreset) => void
}) {
  const [name, setName] = useState(preset?.name ?? '')
  const [avatar, setAvatar] = useState(preset?.avatar ?? 'maja')
  const [department, setDepartment] = useState(preset?.department ?? '')
  const [character, setCharacter] = useState(preset?.character ?? '')
  const [skillNames, setSkillNames] = useState(preset?.skills.map(skill => skill.name).join(', ') ?? '')

  return (
    <form
      className="grid gap-3 rounded-lg border border-border/60 bg-muted/20 p-3"
      onSubmit={event => {
        event.preventDefault()
        const trimmedName = name.trim()
        const trimmedCharacter = character.trim()

        if (!trimmedName || !trimmedCharacter) {
          return
        }

        const now = new Date().toISOString()
        onSave({
          id: preset?.id ?? `custom-${crypto.randomUUID()}`,
          name: trimmedName,
          character: trimmedCharacter,
          avatar,
          department: department.trim(),
          exampleTask: preset?.exampleTask,
          skills: [
            ...new Set(
              skillNames
                .split(',')
                .map(name => name.trim())
                .filter(Boolean)
            )
          ].map(name => ({ name })),
          created_at: preset?.created_at ?? now,
          updated_at: now
        })
      }}
    >
      <fieldset className="grid gap-3">
        <legend className="mb-2 text-sm font-medium">Wybierz avatar</legend>
        <div className="flex flex-wrap gap-3">
          {CHARACTER_AVATARS.map(item => (
            <button
              aria-label={`Avatar ${item.name}`}
              aria-pressed={avatar === item.id}
              className="office-avatar-option rounded-xl"
              key={item.id}
              onClick={() => setAvatar(item.id)}
              type="button"
            >
              <CharacterAvatar avatar={item.id} name={item.name} />
            </button>
          ))}
        </div>
      </fieldset>
      <label className="grid gap-1 text-sm font-medium">
        Nazwa agenta
        <Input
          aria-label="Nazwa agenta"
          maxLength={120}
          onChange={event => setName(event.target.value)}
          required
          value={name}
        />
      </label>
      <label className="grid gap-1 text-sm font-medium">
        Dział lub specjalizacja
        <Input
          maxLength={80}
          onChange={event => setDepartment(event.target.value)}
          placeholder="Np. Marketing, Finanse, Mój asystent"
          value={department}
        />
      </label>
      <label className="grid gap-1 text-sm font-medium">
        Charakter i instrukcje
        <textarea
          aria-label="Instrukcje agenta"
          className="min-h-36 rounded-md border border-input bg-background px-3 py-2 text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          maxLength={12000}
          onChange={event => setCharacter(event.target.value)}
          required
          value={character}
        />
      </label>
      <p className="text-sm text-muted-foreground">
        Opisz zadania, styl rozmowy i granice działania. Avatar jest ilustracją; rola nie tworzy oddzielnego konta ani
        uprawnień.
      </p>
      <label className="grid gap-1 text-sm font-medium">
        Skille do tej roli (nazwy oddziel przecinkami)
        <Input
          aria-label="Skille do roli"
          onChange={event => setSkillNames(event.target.value)}
          placeholder="raport-tygodniowy, research"
          value={skillNames}
        />
      </label>
      <div className="flex justify-end gap-2">
        <Button onClick={onCancel} size="sm" type="button" variant="ghost">
          Anuluj
        </Button>
        <Button size="sm" type="submit">
          Zapisz rolę
        </Button>
      </div>
    </form>
  )
}
