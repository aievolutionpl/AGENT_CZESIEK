import { capabilityScoped, hermesApi, type ProfileScope } from './client'

export function previewElevenLabsVoice(voice: string, language: string, scope: ProfileScope) {
  return hermesApi<{ audio: string; mime: string }>({
    ...capabilityScoped(scope),
    path: '/api/audio/elevenlabs/preview',
    method: 'POST',
    body: { voice, language },
    timeoutMs: 60_000
  })
}
