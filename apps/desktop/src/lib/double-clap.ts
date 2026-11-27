/** Recognises two short, separated microphone peaks without reacting to steady speech. */
export function createDoubleClapDetector() {
  let pulseStarted = -1
  let firstClap = -1
  let lastQuiet = -1
  let cooldownUntil = 0

  return {
    feed(level: number, now: number): boolean {
      if (now < cooldownUntil) {
        return false
      }

      if (level < 0.12) {
        if (pulseStarted >= 0) {
          const duration = now - pulseStarted
          pulseStarted = -1

          if (duration >= 25 && duration <= 180) {
            if (firstClap >= 0 && now - firstClap >= 140 && now - firstClap <= 750) {
              firstClap = -1
              cooldownUntil = now + 2000
              lastQuiet = now

              return true
            }

            firstClap = now
          }
        }

        lastQuiet = now
      } else if (level >= 0.38 && pulseStarted < 0 && lastQuiet >= 0 && now - lastQuiet <= 180) {
        pulseStarted = now
      }

      if (firstClap >= 0 && now - firstClap > 750) {
        firstClap = -1
      }

      if (pulseStarted >= 0 && now - pulseStarted > 180) {
        pulseStarted = -1
      }

      return false
    },
    reset(): void {
      pulseStarted = -1
      firstClap = -1
      lastQuiet = -1
      cooldownUntil = 0
    }
  }
}
