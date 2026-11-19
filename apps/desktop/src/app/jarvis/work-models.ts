/** Display hints only. The active backend supplies available model IDs. */
export const WORK_MODELS: Record<string, { pl: string; en: string }> = {
  'openai/gpt-6.2-astra': { pl: 'Analiza i planowanie', en: 'Analysis and planning' },
  'anthropic/claude-fable-5.2': { pl: 'Zadania wieloetapowe', en: 'Multi-step tasks' },
  'anthropic/claude-haiku-5.5': { pl: 'Krótkie zadania', en: 'Short tasks' },
  'openai/gpt-6.2-sol': { pl: 'Praca i kodowanie', en: 'Work and coding' },
  'anthropic/claude-sonnet-5.5': { pl: 'Kod i dokumenty', en: 'Code and documents' },
  'anthropic/claude-opus-5.5': { pl: 'Złożone zadania', en: 'Complex tasks' },
  'google/gemini-3.8-flash': { pl: 'Szybka analiza', en: 'Fast analysis' },
  'openai/gpt-6-luna': { pl: 'Oszczędna praca', en: 'Economical work' }
}

export function workModelHint(model: string, locale: string): string | undefined {
  return WORK_MODELS[model]?.[locale === 'pl' ? 'pl' : 'en']
}
