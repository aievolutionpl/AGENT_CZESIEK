import type { LiveVoiceProviderId } from '@/api/voice-realtime'

export type VoiceCharacter = 'female' | 'male' | 'neutral'

export interface LiveVoice {
  character: VoiceCharacter
  /** One word on how it sounds, in Polish and English. */
  feel: { en: string; pl: string }
  id: string
}

/** The voices each Live provider offers, male first: the default is the first one. */
export const LIVE_VOICES: Record<LiveVoiceProviderId, readonly LiveVoice[]> = {
  gemini: [
    { character: 'male', feel: { en: 'upbeat', pl: 'energiczny' }, id: 'Puck' },
    { character: 'male', feel: { en: 'informative', pl: 'rzeczowy' }, id: 'Charon' },
    { character: 'male', feel: { en: 'excitable', pl: 'żywy' }, id: 'Fenrir' },
    { character: 'male', feel: { en: 'firm', pl: 'stanowczy' }, id: 'Orus' },
    { character: 'female', feel: { en: 'bright', pl: 'jasny' }, id: 'Zephyr' },
    { character: 'female', feel: { en: 'firm', pl: 'stanowcza' }, id: 'Kore' },
    { character: 'female', feel: { en: 'light', pl: 'lekka' }, id: 'Leda' },
    { character: 'female', feel: { en: 'breezy', pl: 'lekka' }, id: 'Aoede' }
  ],
  openai: [
    { character: 'male', feel: { en: 'warm, steady', pl: 'ciepły, spokojny' }, id: 'cedar' },
    { character: 'male', feel: { en: 'calm', pl: 'opanowany' }, id: 'ash' },
    { character: 'male', feel: { en: 'clear', pl: 'wyraźny' }, id: 'echo' },
    { character: 'male', feel: { en: 'expressive', pl: 'wyrazisty' }, id: 'ballad' },
    { character: 'male', feel: { en: 'lively', pl: 'żywy' }, id: 'verse' },
    { character: 'neutral', feel: { en: 'balanced', pl: 'wyważony' }, id: 'alloy' },
    { character: 'female', feel: { en: 'bright', pl: 'jasna' }, id: 'marin' },
    { character: 'female', feel: { en: 'friendly', pl: 'przyjazna' }, id: 'coral' },
    { character: 'female', feel: { en: 'soft', pl: 'miękka' }, id: 'sage' },
    { character: 'female', feel: { en: 'gentle', pl: 'łagodna' }, id: 'shimmer' }
  ]
}

/** The config key that holds the voice of a provider. */
export const voiceConfigKey = (provider: LiveVoiceProviderId) =>
  provider === 'gemini' ? 'voice.realtime.gemini.voice' : 'voice.realtime.voice'
