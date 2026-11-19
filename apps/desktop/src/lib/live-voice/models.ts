/** The voices Live conversation can run on; `provider:model` is the choice's identity. */
export const LIVE_VOICE_MODELS = [
  { label: 'Gemini 3.8 Live', model: 'gemini-3.8-live', provider: 'gemini' },
  { label: 'Gemini 3.8 Live Extended Thinking', model: 'gemini-3.8-live-extended-thinking', provider: 'gemini' },
  { label: 'Gemini 3.1 Flash Live', model: 'gemini-3.1-flash-live-preview', provider: 'gemini' },
  { label: 'OpenAI Realtime 2.1', model: 'gpt-realtime-2.1', provider: 'openai' },
  { label: 'OpenAI Realtime 2.1 mini', model: 'gpt-realtime-2.1-mini', provider: 'openai' },
  { label: 'OpenAI Realtime', model: 'gpt-realtime', provider: 'openai' }
] as const
