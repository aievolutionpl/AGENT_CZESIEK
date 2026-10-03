import { useEffect, useRef, useState } from 'react'

import { notifyError } from '@/store/notifications'

export interface VoiceSample {
  audio: string
  mime: string
}

/** A page owns one player; an obsolete request can neither play nor report an error. */
export function useVoicePreview(owner: string, failed: string) {
  const [playing, setPlaying] = useState<string | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const generation = useRef(0)
  const audio = useRef<HTMLAudioElement | null>(null)
  const cache = useRef(new Map<string, string>())

  const stop = () => {
    generation.current += 1
    audio.current?.pause()
    audio.current = null
    setPlaying(null)
    setLoading(null)
  }

  // eslint-disable-next-line no-restricted-syntax -- player lifecycle and request generation, not mirrored atom state
  useEffect(() => {
    const samples = cache.current
    setPlaying(null)
    setLoading(null)

    return () => {
      generation.current += 1
      audio.current?.pause()
      audio.current = null
      samples.forEach(url => URL.revokeObjectURL(url))
      samples.clear()
    }
  }, [owner])

  const play = async (id: string, fetchSample: () => Promise<VoiceSample>) => {
    const was = playing
    stop()

    if (was === id) {
      return
    }

    const token = generation.current
    setLoading(id)

    try {
      let url = cache.current.get(id)

      if (!url) {
        const sample = await fetchSample()

        if (token !== generation.current) {
          return
        }

        const bytes = Uint8Array.from(atob(sample.audio), char => char.charCodeAt(0))
        url = URL.createObjectURL(new Blob([bytes], { type: sample.mime }))
        cache.current.set(id, url)
      }

      if (token !== generation.current) {
        return
      }

      const element = new Audio(url)
      audio.current = element

      element.onended = () => {
        if (token === generation.current) {
          setPlaying(null)
        }
      }

      setPlaying(id)
      await element.play()
    } catch (error) {
      if (token === generation.current) {
        setPlaying(null)
        notifyError(error, failed)
      }
    } finally {
      if (token === generation.current) {
        setLoading(null)
      }
    }
  }

  return { loading, play, playing, stop }
}
