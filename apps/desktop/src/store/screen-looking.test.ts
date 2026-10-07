// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { $screenLooking, LOOKING_MIN_MS, whileLooking } from './screen-looking'

beforeEach(() => vi.useFakeTimers())

afterEach(() => {
  vi.useRealTimers()
  $screenLooking.set(false)
})

describe('whileLooking', () => {
  it('is on during the capture and stays on for the minimum, then goes off', async () => {
    let seen = false

    const result = await whileLooking(async () => {
      seen = $screenLooking.get()

      return 'shot'
    })

    expect(result).toBe('shot')
    expect(seen).toBe(true)
    expect($screenLooking.get()).toBe(true)

    vi.advanceTimersByTime(LOOKING_MIN_MS)

    expect($screenLooking.get()).toBe(false)
  })

  it('still turns off when the capture fails, and passes the error on', async () => {
    await expect(
      whileLooking(async () => {
        throw new Error('denied')
      })
    ).rejects.toThrow('denied')

    vi.advanceTimersByTime(LOOKING_MIN_MS)

    expect($screenLooking.get()).toBe(false)
  })
})
