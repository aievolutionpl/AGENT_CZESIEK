import { describe, expect, it } from 'vitest'

import { getNested } from './helpers'
import { selectedVoiceProvider, withVoiceProvider } from './voice-provider-choice'

describe('voice provider configuration', () => {
  it('uses Gemini for a fresh profile and respects a saved OpenAI choice', () => {
    expect(selectedVoiceProvider({})).toBe('gemini')
    expect(selectedVoiceProvider({ voice: { realtime: { provider: 'openai' } } })).toBe('openai')
  })

  it('switches the actual engine while preserving worker models, API config and voices', () => {
    const original = {
      model: { provider: 'openrouter', default: 'worker-model' },
      voice: { engine: 'realtime', realtime: { provider: 'gemini', gemini: { voice: 'Puck' } } },
      tts: { provider: 'edge', elevenlabs: { voice_id: 'my-voice' } }
    }

    const eleven = withVoiceProvider(original, 'elevenlabs')
    expect(selectedVoiceProvider(eleven)).toBe('elevenlabs')
    expect(getNested(eleven, 'voice.engine')).toBe('classic')
    expect(getNested(eleven, 'stt.enabled')).toBe(true)
    expect(getNested(eleven, 'tts.elevenlabs.voice_id')).toBe('my-voice')
    expect(getNested(eleven, 'model')).toEqual(original.model)
    expect(original.tts.provider).toBe('edge')

    const openai = withVoiceProvider(eleven, 'openai')
    expect(selectedVoiceProvider(openai)).toBe('openai')
    expect(getNested(openai, 'voice.engine')).toBe('realtime')
    expect(getNested(openai, 'voice.realtime.gemini.voice')).toBe('Puck')
    expect(getNested(openai, 'model')).toEqual(original.model)
    expect(selectedVoiceProvider(withVoiceProvider(openai, 'gemini'))).toBe('gemini')
  })

  it('does not mistake ElevenLabs fallback synthesis for the Live conversation provider', () => {
    expect(selectedVoiceProvider({ voice: { engine: 'realtime' }, tts: { provider: 'elevenlabs' } })).toBe('gemini')
  })
})
