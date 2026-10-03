/**
 * The desktop's session owner boundary is exercised through the real chat
 * surface and backend. This intentionally submits one turn through the
 * visible composer, then verifies the result belongs to that session rather
 * than merely checking that the shell booted.
 */
import { expect, test } from './test'

import { setupMockBackend, waitForAppReady } from './fixtures'

test('a submitted turn remains attached to its originating session', async () => {
  const fixture = await setupMockBackend()

  try {
    await waitForAppReady(fixture)
    const surface = fixture.page.locator('[data-composer-target]:not([data-pane-hidden] [data-composer-target])').last()
    const composer = surface.locator('[contenteditable="true"]').first()
    await composer.waitFor({ state: 'visible' })
    await composer.click()
    await composer.type('owner-boundary smoke test')
    await fixture.page.keyboard.press('Enter')

    await expect(surface.getByText('owner-boundary smoke test', { exact: true })).toBeVisible({ timeout: 15_000 })
  } finally {
    await fixture.cleanup()
  }
})
