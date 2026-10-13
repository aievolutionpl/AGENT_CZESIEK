import { createRoot } from 'react-dom/client'

import { JarvisOnboarding } from '@/app/jarvis/onboarding'
import { I18nProvider } from '@/i18n'

// Browser-only mock backend. Persistence stays in this browser's isolated storage.
const scenario = new URLSearchParams(location.search).get('scenario')
window.hermesDesktop = {
  api: async request => {
    if (request.path === '/api/providers/validate') {
      const mode = localStorage.getItem('mock-mode') ?? scenario
      if (mode === 'hung') return new Promise(() => {})
      if (mode === 'offline') throw new Error('Mock offline')
      return { ok: mode !== 'invalid', reachable: true }
    }
    if (request.path === '/api/env' && request.method === 'PUT') {
      localStorage.setItem('mock-key-saved', String(request.body?.value === 'mock-only-key'))
      return { ok: true }
    }
    return {}
  },
  openExternal: async () => {}
}
const loadOptions = async () => ({
  providers: [
    {
      name: 'OpenRouter',
      slug: 'openrouter',
      authenticated: localStorage.getItem('mock-key-saved') === 'true',
      models: ['deepseek/deepseek-v4.1-flash']
    }
  ],
  model: 'deepseek/deepseek-v4.1-flash',
  provider: 'openrouter'
})
createRoot(document.getElementById('root')).render(
  <I18nProvider configClient={null} initialLocale="en">
    <JarvisOnboarding
      initialStep={scenario === 'skip' ? 'welcome' : 'engine'}
      loadConfig={scenario === 'skip' ? () => new Promise(() => {}) : async () => ({})}
      loadModelOptions={loadOptions}
      onDismiss={() => {
        document.body.dataset.dismissed = 'true'
      }}
      scope={{ connectionId: 'local', profile: 'default' }}
    />
  </I18nProvider>
)
