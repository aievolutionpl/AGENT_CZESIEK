import { getNested, setNested } from './helpers'

export type VoiceProviderChoice = 'gemini' | 'openai' | 'elevenlabs'

export const VOICE_PROVIDER_KEYS = {
  gemini: 'GEMINI_API_KEY',
  openai: 'VOICE_TOOLS_OPENAI_KEY',
  elevenlabs: 'ELEVENLABS_API_KEY'
} as const

export function selectedVoiceProvider(config: Record<string, unknown>): VoiceProviderChoice {
  if (getNested(config, 'voice.engine') === 'classic' && getNested(config, 'tts.provider') === 'elevenlabs') {
    return 'elevenlabs'
  }

  return getNested(config, 'voice.realtime.provider') === 'openai' ? 'openai' : 'gemini'
}

/** Switch the actual conversation engine, not just the visible voice catalog. */
export function withVoiceProvider(config: Record<string, unknown>, provider: VoiceProviderChoice) {
  let next = setNested(config, 'voice.engine', provider === 'elevenlabs' ? 'classic' : 'realtime')

  if (provider === 'elevenlabs') {
    next = setNested(next, 'tts.provider', 'elevenlabs')
    next = setNested(next, 'stt.enabled', true)
  } else {
    next = setNested(next, 'voice.realtime.provider', provider)
  }

  return next
}
