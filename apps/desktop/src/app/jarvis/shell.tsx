import './glass.css'
import './liquid-glass.css'

import { useStore } from '@nanostores/react'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'

import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'
import { $interfaceMaterial } from '@/store/interface-material'
import { $productShellNav } from '@/store/product-shell'

import { JarvisCore } from './core'
import { JARVIS_AUXILIARY_VIEWS, JARVIS_MAIN_VIEWS, type JarvisShellView } from './i18n'
import { JarvisNavigation } from './navigation'
import { $jarvisUi } from './store'

type SurfaceSlots = Partial<Record<JarvisShellView, ReactNode>>

export interface JarvisShellProps {
  activeView?: JarvisShellView
  children?: ReactNode
  className?: string
  initialView?: JarvisShellView
  surfaces?: SurfaceSlots
  onViewChange?: (view: JarvisShellView) => void
}

function isJarvisShellView(value: JarvisShellView | undefined): value is JarvisShellView {
  return Boolean(value && ([...JARVIS_MAIN_VIEWS, ...JARVIS_AUXILIARY_VIEWS] as readonly string[]).includes(value))
}

function JarvisHomeSurface() {
  const state = useStore($jarvisUi)

  return (
    <section className="flex h-full min-h-0 flex-col items-center justify-center gap-5 px-4 py-8 text-center">
      <JarvisCore live taskPhase={state.task.phase} voice={state.voice} />
    </section>
  )
}

export function JarvisShell({
  activeView: controlledView,
  children,
  className,
  initialView = 'jarvis',
  onViewChange,
  surfaces
}: JarvisShellProps) {
  const { t } = useI18n()
  const material = useStore($interfaceMaterial)

  useEffect(() => {
    document.documentElement.dataset.czesiekMaterial = material
  }, [material])

  const [uncontrolledView, setUncontrolledView] = useState<JarvisShellView>(() =>
    isJarvisShellView(initialView) ? initialView : 'jarvis'
  )

  const activeView = isJarvisShellView(controlledView) ? controlledView : uncontrolledView
  const copy = t.jarvisShell

  const selectView = (view: JarvisShellView) => {
    if (controlledView === undefined) {
      setUncontrolledView(view)
    }

    onViewChange?.(view)
  }

  const activeSurface = surfaces?.[activeView] ?? children ?? (activeView === 'jarvis' ? <JarvisHomeSurface /> : null)
  const wrapsRuntimeChild = children !== undefined

  // The rail takes over the runtime sidebar's destination rows while it wraps it.
  useEffect(() => {
    if (!wrapsRuntimeChild) {
      return undefined
    }

    $productShellNav.set(true)

    return () => $productShellNav.set(false)
  }, [wrapsRuntimeChild])

  // Layout containment makes the workspace the containing block for `fixed`
  // descendants: the runtime's route overlays (Tasks, Settings, Tools) then
  // cover the workspace, not the whole window, and the nav rail stays usable.
  const surfaceClassName = cn(
    'min-h-0 min-w-0 flex-1 overflow-hidden bg-(--ui-chat-surface-background)',
    wrapsRuntimeChild && '[contain:layout]'
  )

  const surfaceProps = {
    'aria-label': copy.mainLabel,
    className: surfaceClassName,
    'data-jarvis-view': activeView
  }

  return (
    <div
      className={cn(
        'flex h-screen min-h-0 w-screen flex-col overflow-hidden bg-(--ui-bg-chrome) text-(--ui-text-primary) md:flex-row',
        className
      )}
      data-jarvis-shell=""
    >
      <JarvisNavigation activeView={activeView} copy={copy} onSelect={selectView} />
      {wrapsRuntimeChild ? (
        <div role="group" {...surfaceProps}>
          {activeSurface}
        </div>
      ) : (
        <main {...surfaceProps}>{activeSurface}</main>
      )}
    </div>
  )
}
