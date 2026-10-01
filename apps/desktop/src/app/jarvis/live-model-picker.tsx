import { useState } from 'react'
import { useNavigate } from 'react-router'

import { ModelBrandIcon } from '@/components/model-brand-icon'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useI18n } from '@/i18n'
import { Check, ChevronDown } from '@/lib/icons'
import { cn } from '@/lib/utils'

import { SETTINGS_ROUTE } from '../routes'

import { LIVE_VOICE_MODELS, liveModelValue, useLiveVoiceModel } from './live-model-choice'

export function LiveModelPicker({ connected }: { connected: boolean }) {
  const { locale } = useI18n()
  const { choose, label: currentLabel, live, saving } = useLiveVoiceModel()
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const value = liveModelValue(live)
  const pl = locale === 'pl'

  return (
    <div className="mb-4 space-y-2">
      <span className="block text-xs font-medium text-(--ui-text-secondary)" id="czesiek-live-model">
        {pl ? 'Rozmowa Live · głos Cześka' : 'Live conversation · voice'}
      </span>
      <Popover onOpenChange={setOpen} open={open}>
        <PopoverTrigger asChild>
          <button
            aria-labelledby="czesiek-live-model"
            className="jarvis-well jarvis-field flex w-full min-w-0 items-center gap-3 px-3 py-2.5 text-left outline-none focus-visible:outline focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-(--ui-accent) disabled:opacity-60"
            disabled={!connected || saving}
            type="button"
          >
            <ModelBrandIcon hints={[live.provider]} model={live.model} />
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-(--ui-text-primary)">{currentLabel}</span>
            <ChevronDown
              className={cn('size-4 shrink-0 text-(--ui-text-tertiary) transition-transform', open && 'rotate-180')}
            />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="jarvis-menu grid w-(--radix-popover-trigger-width) gap-1 p-1.5">
          {LIVE_VOICE_MODELS.map(item => {
            const selected = liveModelValue(item) === value

            return (
              <button
                aria-pressed={selected}
                className={cn(
                  'jarvis-menu-item flex min-h-11 w-full items-center gap-3 rounded-xl px-2.5 text-left text-sm outline-none',
                  selected && 'bg-(--ui-accent)/12'
                )}
                key={item.model}
                onClick={() => {
                  setOpen(false)
                  void choose(liveModelValue(item))
                }}
                type="button"
              >
                <ModelBrandIcon hints={[item.provider]} model={item.model} size="sm" />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {selected ? <Check className="size-4 shrink-0 text-(--ui-accent)" /> : null}
              </button>
            )
          })}
        </PopoverContent>
      </Popover>
      <p className="text-xs leading-relaxed text-(--ui-text-tertiary)">
        {pl
          ? 'Zmiana działa od następnej rozmowy. Zadania mają osobny model poniżej.'
          : 'Applies to the next call. Tasks use the separate model below.'}
      </p>
      <button
        className="text-xs font-medium text-(--ui-accent) underline-offset-4 hover:underline"
        onClick={() => navigate(`${SETTINGS_ROUTE}?tab=voice`)}
        type="button"
      >
        {pl ? 'Klucze i ustawienia głosu' : 'Voice keys and settings'}
      </button>
    </div>
  )
}
