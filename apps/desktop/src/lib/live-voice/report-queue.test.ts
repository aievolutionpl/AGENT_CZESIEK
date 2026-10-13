import { describe, expect, it, vi } from 'vitest'

import { VoiceReportQueue } from './report-queue'

describe('VoiceReportQueue', () => {
  it('keeps a silent report pending, retries it, and advances only after speech starts', () => {
    const failed = vi.fn()
    const queue = new VoiceReportQueue(failed)
    const notify = vi.fn(() => true)
    queue.push('working', undefined, true)
    queue.push('result')
    queue.push('next')
    queue.drain(notify, 0)
    queue.drain(notify, 11_999)
    expect(notify).toHaveBeenCalledTimes(1)
    queue.drain(notify, 12_000)
    expect(notify).toHaveBeenNthCalledWith(2, 'result')
    queue.spoken()
    queue.drain(notify, 12_001)
    expect(notify).toHaveBeenLastCalledWith('next')
    expect(failed).not.toHaveBeenCalled()
  })

  it('does not lose rejected delivery, bounds silent retries and exposes the result as fallback', () => {
    const failed = vi.fn()
    const queue = new VoiceReportQueue(failed)
    const notify = vi.fn(() => false)
    queue.push('result')
    queue.drain(notify, 0)
    queue.spoken()
    expect(queue.pending).toBe(true)
    notify.mockReturnValue(true)

    for (const now of [1, 12_001, 24_001, 36_001]) {
      queue.drain(notify, now)
    }
    expect(failed).toHaveBeenCalledExactlyOnceWith('result')
    expect(queue.pending).toBe(false)
  })
})
