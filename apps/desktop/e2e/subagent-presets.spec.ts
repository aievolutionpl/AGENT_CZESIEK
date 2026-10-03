import { setupMockBackend, waitForAppReady } from './fixtures'
import { expect, test } from './test'

test('a ready teammate prepares an editable delegated task without submitting it', async () => {
  test.setTimeout(180_000)
  const backend = await setupMockBackend({ language: 'pl' })
  const { page } = backend

  try {
    await page.getByRole('button', { name: /Kliknij logo, aby rozpocząć|Click the logo to begin/ }).click()
    await page.getByRole('button', { name: /Dokończę później|Finish later/ }).click()
    await page.getByRole('button', { name: 'Workspace', exact: true }).click()
    await waitForAppReady(backend, 120_000)
    const later = page.getByRole('button', { name: /Wybiorę dostawcę później|I'll choose provider later/ })

    if (
      await later.waitFor({ state: 'visible', timeout: 3_000 }).then(
        () => true,
        () => false
      )
    ) {
      await later.click()
    }

    await page.locator('[data-jarvis-nav-view="agents"]').click()
    const card = page.locator('article').filter({ has: page.getByRole('heading', { name: 'Maja · Marketing' }) })
    await card.getByRole('button', { name: 'Wstaw przykładowe zadanie' }).click()
    const task = await card.getByRole('textbox', { name: 'Zadanie dla Maja · Marketing' }).inputValue()
    await card.getByRole('button', { name: 'Przygotuj zadanie' }).click()

    const composer = page
      .locator('[data-slot="composer-root"] textarea, [data-slot="composer-root"] [contenteditable="true"]')
      .first()

    await expect.poll(async () => await composer.inputValue().catch(() => composer.textContent())).toContain(task)
    await expect.poll(async () => await composer.inputValue().catch(() => composer.textContent())).toContain('Maja')
    await expect(page.getByRole('heading', { name: 'Twoje biuro agentów' })).toHaveCount(0)
  } finally {
    await backend.cleanup()
  }
})
