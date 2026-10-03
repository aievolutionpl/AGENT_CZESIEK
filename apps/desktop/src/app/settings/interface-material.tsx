import { useStore } from '@nanostores/react'

import { useI18n } from '@/i18n'
import { $interfaceMaterial, type InterfaceMaterial, setInterfaceMaterial } from '@/store/interface-material'

export function InterfaceMaterialSettings() {
  const material = useStore($interfaceMaterial)
  const { locale } = useI18n()
  const polish = locale === 'pl'

  const options: { id: InterfaceMaterial; label: string; description: string }[] = [
    {
      id: 'liquid',
      label: 'Liquid Glass',
      description: polish
        ? 'Przezroczyste panele, refleksy i tapeta w całym oknie.'
        : 'Translucent panels, highlights and wallpaper across the window.'
    },
    {
      id: 'standard',
      label: polish ? 'Klasyczny' : 'Standard',
      description: polish ? 'Spokojne, mocniej kryjące powierzchnie.' : 'Quiet, more opaque surfaces.'
    }
  ]

  return (
    <section
      aria-labelledby="interface-material-heading"
      className="my-5 rounded-2xl border border-border/70 bg-background/60 p-4"
    >
      <h3 className="text-base font-semibold" id="interface-material-heading">
        {polish ? 'Wygląd interfejsu' : 'Interface appearance'}
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {polish
          ? 'Wybierz swój styl. Zmiana jest zapisywana na tym komputerze.'
          : 'Choose your style. This preference is saved on this computer.'}
      </p>
      <div aria-labelledby="interface-material-heading" className="mt-3 grid gap-3 sm:grid-cols-2" role="radiogroup">
        {options.map(option => (
          <button
            aria-checked={material === option.id}
            className="rounded-xl border border-border/70 bg-background/40 p-3 text-left transition-colors hover:bg-accent/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-checked:border-primary aria-checked:bg-primary/10"
            data-interface-style={option.id}
            key={option.id}
            onClick={() => setInterfaceMaterial(option.id)}
            onKeyDown={event => {
              if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
                return
              }

              event.preventDefault()
              const next = options.find(item => item.id !== option.id)!
              setInterfaceMaterial(next.id)
              event.currentTarget.parentElement
                ?.querySelector<HTMLButtonElement>(`[data-interface-style="${next.id}"]`)
                ?.focus()
            }}
            role="radio"
            tabIndex={material === option.id ? 0 : -1}
            type="button"
          >
            <span className="block text-sm font-semibold">{option.label}</span>
            <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{option.description}</span>
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        {polish
          ? 'Systemowe ograniczenie przezroczystości zachowuje czytelne, kryjące panele.'
          : 'System transparency preferences keep panels readable and opaque.'}
      </p>
    </section>
  )
}
