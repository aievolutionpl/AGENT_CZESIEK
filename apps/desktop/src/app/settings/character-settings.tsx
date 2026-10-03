import { useStore } from '@nanostores/react'

import { CHARACTERS } from '@/app/jarvis/characters'
import { useI18n } from '@/i18n'
import { Check, Mic, Sparkles } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { $character, $voicePreset, setCharacter, setVoicePreset } from '@/store/character'

import { Pill, SectionHeading, SettingsContent } from './primitives'

// One row shape for both pickers: a radio the eye can scan. Buttons rather than
// inputs because the whole card is the hit target — this surface is used on
// tablets and phones, where a 16px radio is not a target.
const ROW_CLASS = 'flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors'
const ROW_ACTIVE = 'border-primary/60 bg-primary/10'
const ROW_IDLE = 'border-(--ui-stroke-tertiary) bg-(--ui-bg-secondary) hover:bg-(--chrome-action-hover)'

function RowMark({ active }: { active: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border',
        active ? 'border-primary bg-primary text-primary-foreground' : 'border-white/25'
      )}
    >
      {active && <Check className="size-3" />}
    </span>
  )
}

/**
 * Who answers, and in which voice. Both choices are renderer-local preferences
 * (they change the words on the home screen and which voice we hand the
 * backend), so they persist in the app's own storage — see `@/store/character`,
 * which also owns the rule that a voice never outlives its character.
 */
export function CharacterSettings() {
  const { t } = useI18n()
  const copy = t.settings.character
  const character = useStore($character)
  const voice = useStore($voicePreset)

  return (
    <SettingsContent>
      <SectionHeading icon={Sparkles} meta={character.name} title={copy.title} />
      <p className="mb-3 text-sm text-muted-foreground">{copy.characterHint}</p>

      <div aria-label={copy.characterLabel} className="flex flex-col gap-2" role="radiogroup">
        {CHARACTERS.map(option => {
          const active = option.id === character.id

          return (
            <button
              aria-checked={active}
              className={cn(ROW_CLASS, active ? ROW_ACTIVE : ROW_IDLE)}
              key={option.id}
              onClick={() => setCharacter(option.id)}
              role="radio"
              type="button"
            >
              <RowMark active={active} />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{option.name}</span>
                <span className="block text-xs text-muted-foreground">{option.tagline}</span>
              </span>
            </button>
          )
        })}
      </div>

      <SectionHeading icon={Mic} meta={voice?.label} title={copy.voiceLabel} />
      <p className="mb-3 text-sm text-muted-foreground">{copy.voiceHint}</p>

      <div aria-label={copy.voiceLabel} className="flex flex-col gap-2" role="radiogroup">
        {character.voicePresets.map(preset => {
          const active = preset.id === voice?.id

          return (
            <button
              aria-checked={active}
              className={cn(ROW_CLASS, active ? ROW_ACTIVE : ROW_IDLE)}
              key={preset.id}
              onClick={() => setVoicePreset(preset.id)}
              role="radio"
              type="button"
            >
              <RowMark active={active} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{preset.label}</span>
                <span className="block text-xs text-muted-foreground">{preset.provider}</span>
              </span>
              {preset.recommended && <Pill>{copy.recommended}</Pill>}
            </button>
          )
        })}
      </div>

      <p className="mt-4 text-xs text-muted-foreground">{copy.applies}</p>
    </SettingsContent>
  )
}
