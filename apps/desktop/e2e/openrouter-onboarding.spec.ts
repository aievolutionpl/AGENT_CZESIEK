import { setupNoProvider } from './fixtures'
import { expect, test } from './test'

test('fresh setup opens the guided onboarding without optional settings screens', async () => {
  const fixture = await setupNoProvider()

  try {
    await fixture.page.getByRole('button', { name: /Kliknij logo, aby rozpocząć|Click (?:the )?logo to begin/ }).click({ timeout: 90_000 })
    await expect(fixture.page.getByTestId('jarvis-onboarding')).toBeVisible({ timeout: 90_000 })
    await expect(fixture.page.getByTestId('jarvis-onboarding-welcome')).toBeVisible()
    await expect(fixture.page.getByText(/Get a key|Zdobądź klucz/)).toHaveCount(0)
  } finally {
    await fixture.cleanup()
  }
})
