import { setupMockBackend, waitForAppReady } from './fixtures'
import { expect, test } from './test'

test.describe('skills management', () => {
  test('opens the scoped skills surface and exposes search and management affordances', async () => {
    const fixture = await setupMockBackend()

    try {
      await waitForAppReady(fixture)
      await fixture.page.getByRole('button', { name: 'More features' }).click()
      await fixture.page.locator('[data-jarvis-nav-view="tools"]').click()

      await expect(fixture.page.getByRole('textbox', { name: /search skills/i })).toBeVisible()
      await expect(fixture.page.getByRole('button', { name: 'Wklej lub utwórz skilla' })).toBeVisible()
    } finally {
      await fixture.cleanup()
    }
  })
})
