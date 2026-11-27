/**
 * The onboarding wizard's one selectable card, plus the roving-focus keyboard
 * handler its radio groups share.
 *
 * Lives on its own so both the steps inside `onboarding.tsx` and the steps in
 * their own modules can use it without importing each other.
 */

import type { ComponentProps, KeyboardEvent, ReactNode } from 'react'

import { cn } from '@/lib/utils'

export function ChoiceCard({
  active,
  description,
  icon,
  label,
  onClick,
  role,
  tabIndex,
  ...props
}: {
  active: boolean
  description: string
  icon: ReactNode
  label: string
  onClick: () => void
  role?: 'radio'
  tabIndex?: number
} & Omit<ComponentProps<'button'>, 'aria-checked' | 'aria-label' | 'className' | 'onClick' | 'role' | 'type'>) {
  return (
    <button
      aria-checked={role === 'radio' ? active : undefined}
      aria-label={label}
      className={cn(
        'min-h-24 rounded-md border p-4 text-left focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#00B7FF]/50',
        active
          ? 'border-[#00B7FF] bg-[#00B7FF]/12'
          : 'border-(--ui-stroke-tertiary) bg-(--ui-bg-tertiary) hover:border-(--ui-stroke-secondary)'
      )}
      onClick={onClick}
      role={role}
      tabIndex={tabIndex}
      type="button"
      {...props}
    >
      <span className="flex items-center gap-2 text-sm font-semibold">
        {icon}
        {label}
      </span>
      <span className="mt-2 block text-sm leading-6 text-(--ui-text-secondary)">{description}</span>
    </button>
  )
}

/**
 * Arrow/Home/End roving selection for a group of `ChoiceCard`s.
 *
 * `attribute` is the data attribute each card carries (`data-approval-mode`,
 * `data-computer-mode`, …) — selection moves and focus follows it, which is
 * what a radiogroup owes the keyboard.
 */
export function choiceRadioKeyHandler<T extends string>({
  attribute,
  current,
  onSelect,
  values
}: {
  attribute: string
  current: T
  onSelect: (value: T) => void
  values: readonly T[]
}) {
  return (event: KeyboardEvent<HTMLDivElement>) => {
    const index = Math.max(0, values.indexOf(current))
    let nextIndex = index

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (index + 1) % values.length
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (index - 1 + values.length) % values.length
    } else if (event.key === 'Home') {
      nextIndex = 0
    } else if (event.key === 'End') {
      nextIndex = values.length - 1
    } else {
      return
    }

    event.preventDefault()

    const next = values[nextIndex]
    onSelect(next)
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(`[${attribute}="${next}"]`)?.focus()
    })
  }
}
