import { describe, expect, it } from 'vitest'

import { WAVE_BARS, waveTargets } from './voice-wave'

describe('waveTargets', () => {
  it('draws nothing for silence, whatever the phase', () => {
    for (const phase of [0, 1.7, 40]) {
      expect(waveTargets(0, phase).every(value => value === 0)).toBe(true)
    }
  })

  it('is tallest in the middle, stays within the level, and fades to the edges', () => {
    const level = 0.8
    const bars = waveTargets(level, 0)
    const middle = (WAVE_BARS - 1) / 2

    expect(bars).toHaveLength(WAVE_BARS)
    expect(Math.max(...bars)).toBeLessThanOrEqual(level)
    expect(Math.min(...bars)).toBeGreaterThanOrEqual(0)
    expect(bars[middle]!).toBeGreaterThan(bars[2]!)
    expect(bars[0]!).toBeLessThan(0.05)
  })
})
