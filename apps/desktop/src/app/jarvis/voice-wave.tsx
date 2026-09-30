import { useEffect, useRef } from 'react'

import { $micLevel, clampMicLevel } from '@/store/voice-level'

/** Bars in the wave; odd, so one bar sits exactly in the middle. */
export const WAVE_BARS = 27

/**
 * One frame of the wave: a bar per slot, tallest in the middle and falling away to the edges, each
 * swaying a little with `phase`. Silence (level 0) is always zeros, so the wave never fakes activity.
 */
export function waveTargets(level: number, phase: number, bars = WAVE_BARS): number[] {
  const energy = clampMicLevel(level)
  const middle = (bars - 1) / 2

  return Array.from({ length: bars }, (_, i) => {
    const distance = Math.abs(i - middle) / middle
    const envelope = Math.cos((distance * Math.PI) / 2) ** 1.4
    const sway = 0.6 + 0.4 * Math.sin(i * 0.9 + phase) * Math.cos(i * 0.4 - phase * 0.7)

    return energy * envelope * sway
  })
}

/**
 * The voice, made visible and small: a short row of bars under the orb, driven by the real level of the
 * microphone (or of the assistant's voice while it speaks). Resting bars are dots, so the row is a quiet
 * line when nobody talks, and it draws nothing at all while inactive.
 */
export function VoiceWave({ active, reducedMotion = false }: { active: boolean; reducedMotion?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext?.('2d') ?? null

    if (!canvas || !ctx) {
      return undefined
    }

    const bars = new Array<number>(WAVE_BARS).fill(0)
    let opacity = 0
    let phase = 0
    let smooth = 0
    let frame = 0

    const draw = () => {
      const rect = canvas.getBoundingClientRect()
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      const width = Math.max(1, rect.width)
      const height = Math.max(1, rect.height)

      if (canvas.width !== Math.round(width * ratio)) {
        canvas.width = Math.round(width * ratio)
        canvas.height = Math.round(height * ratio)
      }

      ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
      ctx.clearRect(0, 0, width, height)

      if (opacity < 0.01) {
        return
      }

      const slot = width / WAVE_BARS
      const thickness = Math.max(2, slot * 0.42)
      const gradient = ctx.createLinearGradient(0, 0, width, 0)

      gradient.addColorStop(0, '#22d3ee')
      gradient.addColorStop(1, '#a855f7')
      ctx.strokeStyle = gradient
      ctx.lineCap = 'round'
      ctx.lineWidth = thickness
      ctx.globalAlpha = opacity

      for (let i = 0; i < WAVE_BARS; i += 1) {
        const x = slot * (i + 0.5)
        const half = thickness / 2 + bars[i]! * (height / 2 - thickness)

        ctx.beginPath()
        ctx.moveTo(x, height / 2 - half + thickness / 2)
        ctx.lineTo(x, height / 2 + half - thickness / 2)
        ctx.stroke()
      }

      ctx.globalAlpha = 1
    }

    const loop = () => {
      opacity += ((active ? 1 : 0) - opacity) * 0.12
      smooth += (($micLevel.get() || 0) - smooth) * (reducedMotion ? 0.05 : 0.35)
      phase += 0.06

      const goals = waveTargets(smooth, reducedMotion ? 0 : phase)

      for (let i = 0; i < WAVE_BARS; i += 1) {
        bars[i] = bars[i]! + (goals[i]! - bars[i]!) * 0.4
      }

      draw()

      if (active || opacity > 0.01) {
        frame = requestAnimationFrame(loop)
      }
    }

    frame = requestAnimationFrame(loop)

    return () => cancelAnimationFrame(frame)
  }, [active, reducedMotion])

  return <canvas aria-hidden="true" className="h-8 w-44 max-w-full" data-testid="jarvis-voice-wave" ref={canvasRef} />
}
