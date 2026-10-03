import { useStore } from '@nanostores/react'
import { useState } from 'react'

import { ModelBrandIcon } from '@/components/model-brand-icon'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useI18n } from '@/i18n'
import { Check, ChevronDown, Loader2, Mic } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { $activeSessionId, $currentModel, $currentProvider } from '@/store/session'
import type { ModelOptionProvider } from '@/types/hermes'

import { LIVE_VOICE_MODELS, liveModelValue, useLiveVoiceModel } from './live-model-choice'
import { hermesModelGroups, shortModelName } from './model-switcher-options'
import { workModelHint } from './work-models'

const COPY = {
  en: {
    hermes: 'Task model',
    none: 'No model',
    voice: 'Voice model (conversation)',
    voiceNote: 'Applies to the next call.'
  },
  pl: {
    hermes: 'Model zadań',
    none: 'Brak modelu',
    voice: 'Model głosowy (rozmowa)',
    voiceNote: 'Działa od następnej rozmowy.'
  }
} as const

const PILL =
  'jarvis-glass jarvis-glass-hover flex h-10 min-w-0 max-w-56 items-center gap-2 rounded-full pr-2.5 pl-1.5 text-left text-sm text-(--ui-text-primary) outline-none focus-visible:outline focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-(--ui-accent) disabled:opacity-60'

const ROW = 'jarvis-menu-item flex min-h-10 w-full items-center gap-2.5 rounded-xl px-2 text-left text-sm outline-none'

export interface ModelSwitcherProps {
  connected: boolean
  onSelectModel?: (selection: { model: string; provider: string; sessionId?: null | string }) => Promise<boolean> | void
  providers?: readonly ModelOptionProvider[]
}

/** The two models that matter, always in reach: the task model (does the work) and the voice (talks to you). */
export function ModelSwitcher({ connected, onSelectModel, providers }: ModelSwitcherProps) {
  const { locale } = useI18n()
  const copy = locale === 'pl' ? COPY.pl : COPY.en
  const model = useStore($currentModel)
  const provider = useStore($currentProvider)
  const sessionId = useStore($activeSessionId)
  const voice = useLiveVoiceModel()
  const [hermesOpen, setHermesOpen] = useState(false)
  const [voiceOpen, setVoiceOpen] = useState(false)
  const [pending, setPending] = useState<null | string>(null)
  const [modelQuery, setModelQuery] = useState('')
  const groups = hermesModelGroups(providers, { model, provider }, undefined, modelQuery)

  const pickHermes = async (next: string, slug: string) => {
    if (!onSelectModel || pending) {
      return
    }

    setHermesOpen(false)
    setPending(next)

    try {
      await onSelectModel({ model: next, provider: slug, sessionId })
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="flex min-w-0 items-center gap-2" data-testid="jarvis-model-switcher">
      <Popover onOpenChange={setHermesOpen} open={hermesOpen}>
        <PopoverTrigger asChild>
          <button
            aria-label={`${copy.hermes}: ${model ? shortModelName(model) : copy.none}`}
            className={PILL}
            disabled={!connected}
            title={copy.hermes}
            type="button"
          >
            <ModelBrandIcon hints={[provider]} model={model} size="sm" />
            <span className="min-w-0 flex-1 truncate">{model ? shortModelName(model) : copy.none}</span>
            {pending ? (
              <Loader2 className="size-3.5 shrink-0 animate-spin" />
            ) : (
              <ChevronDown
                className={cn(
                  'size-3.5 shrink-0 text-(--ui-text-tertiary) transition-transform',
                  hermesOpen && 'rotate-180'
                )}
              />
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="jarvis-menu max-h-96 w-72 gap-1 overflow-y-auto p-1.5">
          <p className="px-2 pt-1 pb-0.5 text-xs font-medium uppercase tracking-[0.16em] text-(--ui-text-tertiary)">
            {copy.hermes}
          </p>
          <input
            aria-label={locale === 'pl' ? 'Szukaj modelu' : 'Search models'}
            className="jarvis-well my-2 w-full px-3 py-2 text-sm text-(--ui-text-primary)"
            onChange={event => setModelQuery(event.target.value)}
            placeholder={locale === 'pl' ? 'Szukaj modelu…' : 'Search models…'}
            value={modelQuery}
          />
          {groups.length === 0 ? (
            <p className="px-2 py-3 text-sm text-(--ui-text-secondary)">
              {locale === 'pl'
                ? 'Brak pasujących modeli. Zmień wyszukiwanie lub podłącz dostawcę w Ustawieniach → Modele.'
                : 'No matching models. Change the search or connect a provider in Settings → Models.'}
            </p>
          ) : null}
          {groups.map(group => (
            <div className="grid gap-0.5" key={group.slug}>
              <p className="px-2 pt-2 text-xs text-(--ui-text-tertiary)">{group.name}</p>
              {group.models.map(name => {
                const selected = name === model && group.slug === provider

                return (
                  <button
                    aria-pressed={selected}
                    className={cn(ROW, selected && 'bg-(--ui-accent)/12')}
                    disabled={!onSelectModel || pending !== null}
                    key={name}
                    onClick={() => void pickHermes(name, group.slug)}
                    title={name}
                    type="button"
                  >
                    <ModelBrandIcon hints={[group.slug]} model={name} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{shortModelName(name)}</span>
                      {workModelHint(name, locale) ? (
                        <span className="block text-xs text-(--ui-text-secondary)">{workModelHint(name, locale)}</span>
                      ) : null}
                    </span>
                    {selected ? <Check className="size-4 shrink-0 text-(--ui-accent)" /> : null}
                  </button>
                )
              })}
            </div>
          ))}
        </PopoverContent>
      </Popover>

      <Popover onOpenChange={setVoiceOpen} open={voiceOpen}>
        <PopoverTrigger asChild>
          <button
            aria-label={`${copy.voice}: ${voice.label}`}
            className={PILL}
            disabled={!connected || voice.saving}
            title={copy.voice}
            type="button"
          >
            <span className="relative">
              <ModelBrandIcon hints={[voice.live.provider]} model={voice.live.model} size="sm" />
              <Mic className="absolute -right-1 -bottom-1 size-3 rounded-full bg-(--ui-bg-secondary) p-px text-(--ui-accent)" />
            </span>
            <span className="min-w-0 flex-1 truncate">{voice.label}</span>
            {voice.saving ? (
              <Loader2 className="size-3.5 shrink-0 animate-spin" />
            ) : (
              <ChevronDown
                className={cn(
                  'size-3.5 shrink-0 text-(--ui-text-tertiary) transition-transform',
                  voiceOpen && 'rotate-180'
                )}
              />
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="jarvis-menu grid w-64 gap-0.5 p-1.5">
          <p className="px-2 pt-1 pb-0.5 text-xs font-medium uppercase tracking-[0.16em] text-(--ui-text-tertiary)">
            {copy.voice}
          </p>
          {LIVE_VOICE_MODELS.map(item => {
            const selected = liveModelValue(item) === liveModelValue(voice.live)

            return (
              <button
                aria-pressed={selected}
                className={cn(ROW, selected && 'bg-(--ui-accent)/12')}
                key={item.model}
                onClick={() => {
                  setVoiceOpen(false)
                  void voice.choose(liveModelValue(item))
                }}
                type="button"
              >
                <ModelBrandIcon hints={[item.provider]} model={item.model} size="sm" />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {selected ? <Check className="size-4 shrink-0 text-(--ui-accent)" /> : null}
              </button>
            )
          })}
          <p className="px-2 pt-1 text-xs text-(--ui-text-tertiary)">{copy.voiceNote}</p>
        </PopoverContent>
      </Popover>
    </div>
  )
}
