import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { I18nProvider } from '@/i18n'

import { useEnvCredentials } from './env-credentials'
import { envVar } from './test-utils'

const getEnvVars = vi.fn()
const setEnvVar = vi.fn()

vi.mock('@/hermes', () => ({
  deleteEnvVar: vi.fn(),
  getEnvVars: (scope: unknown) => getEnvVars(scope),
  revealEnvVar: vi.fn(),
  setEnvVar: (key: string, value: string, scope: unknown) => setEnvVar(key, value, scope)
}))

function Harness({ scope }: { scope: { connectionId: string; profile: string } }) {
  const { saveValue } = useEnvCredentials(scope)

  return (
    <button onClick={() => void saveValue('OPENROUTER_API_KEY', 'sk-test')} type="button">
      save
    </button>
  )
}

describe('useEnvCredentials', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('reads and writes credentials against the captured connection/profile', async () => {
    getEnvVars.mockResolvedValue({ OPENROUTER_API_KEY: envVar('provider') })
    setEnvVar.mockResolvedValue({ ok: true })
    const scope = { connectionId: 'remote-a', profile: 'research' }

    const { getByRole } = render(
      <I18nProvider configClient={null} initialLocale="en">
        <Harness scope={scope} />
      </I18nProvider>
    )

    await waitFor(() => expect(getEnvVars).toHaveBeenCalledWith(scope))
    getByRole('button', { name: 'save' }).click()
    await waitFor(() => expect(setEnvVar).toHaveBeenCalledWith('OPENROUTER_API_KEY', 'sk-test', scope))
  })
})
