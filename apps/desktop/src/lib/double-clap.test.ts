import { expect, test } from 'vitest'

import { createDoubleClapDetector } from './double-clap'

test('two short microphone peaks trigger once; sustained sound does not', () => {
  const detector = createDoubleClapDetector()

  const samples: Array<[number, number]> = [
    [0, 0.02],
    [80, 0.55],
    [140, 0.04],
    [370, 0.02],
    [420, 0.6],
    [485, 0.03],
    [560, 0.5],
    [640, 0.02],
    [3000, 0.02],
    [3060, 0.5],
    [3320, 0.5],
    [3370, 0.02]
  ]

  expect(samples.filter(([time, level]) => detector.feed(level, time))).toHaveLength(1)
})
