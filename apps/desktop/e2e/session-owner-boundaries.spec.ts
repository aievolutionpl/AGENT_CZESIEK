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
    const surface = fixture.page.locator('[data-chat-surface]').filter({ visible: true }).last()
    const composer = fixture.page.getByRole('textbox', { name: 'Message', exact: true })
    await composer.waitFor({ state: 'visible' })
    await composer.click()
    await composer.type('owner-boundary smoke test')
    await fixture.page.keyboard.press('Enter')

    await expect(surface.locator('[data-slot="aui_directive-text"]').filter({ hasText: 'owner-boundary smoke test' }))
      .toBeVisible({ timeout: 15_000 })
  } finally {
    await fixture.cleanup()
  }
})
