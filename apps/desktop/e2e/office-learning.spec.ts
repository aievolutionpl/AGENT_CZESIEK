import fs from 'node:fs'
import path from 'node:path'

import { setupMockBackend, waitForAppReady } from './fixtures'
import { expect, test } from './test'

test('office teammates, learning and profile settings work through the product shell', async () => {
  test.setTimeout(180_000)

  const fixture = await setupMockBackend({
    extraConfig:
      'voice:\n  engine: realtime\n  realtime:\n    provider: gemini\n    gemini:\n      model: gemini-3.8-live\n      voice: Puck\n'
  })

  const { page, app } = fixture

  const capture = async (name: string) => {
    if (process.env.CZESIEK_CAPTURE_README !== '1') {
      return
    }

    const directory = path.resolve(import.meta.dirname, '../../../docs/assets/czesiek')
    fs.mkdirSync(directory, { recursive: true })
    await page.screenshot({ path: path.join(directory, name), animations: 'disabled', caret: 'hide' })
  }

  try {
    await app.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows().find(item => !item.webContents.getURL().includes('win=overlay'))
      window?.setSize(1440, 1000)
    })
    await page
      .getByRole('button', { name: /Kliknij logo, aby rozpocząć|Click the logo to begin/ })
      .waitFor({ timeout: 120_000 })
    await capture('onboarding-start.png')
    await page.getByRole('button', { name: /Kliknij logo, aby rozpocząć|Click the logo to begin/ }).click()
    await page.waitForSelector('[data-testid="jarvis-onboarding"]', { timeout: 120_000 })
    await expect(page.locator('[data-testid="jarvis-onboarding"] .animate-spin')).toHaveCount(0, { timeout: 60_000 })
    await capture('onboarding-office.png')
    await page.getByRole('button', { name: /Poznajmy się|Get to know each other/ }).click()
    await expect(page.getByRole('button', { name: 'Moja firma', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Moja firma', exact: true }).click()
    await capture('onboarding-profile.png')
    await page.evaluate(() => {
      const prefix = 'ai-evolution-jarvis-onboarding-v1:'
      const keys = Object.keys(localStorage).filter(key => key.startsWith(prefix))

      for (const key of keys.length ? keys : [`${prefix}local::default`]) {
        localStorage.setItem(
          key,
          JSON.stringify({
            version: 3,
            currentStep: 'approvals',
            completedSteps: [
              'welcome',
              'profile',
              'engine',
              'model',
              'voice',
              'access',
              'computer',
              'connections',
              'approvals'
            ],
            selections: {}
          })
        )
        localStorage.setItem(
          `ai-evolution-jarvis-tips-v1:${key.slice(prefix.length)}`,
          JSON.stringify({ version: 1, autoOpened: true, completed: true })
        )
      }
    })
    await page.reload()
    await waitForAppReady(fixture, 120_000)
    const later = page.getByRole('button', { name: /Wybiorę dostawcę później|I'll choose provider later/ })

    if (
      await later.waitFor({ state: 'visible', timeout: 45_000 }).then(
        () => true,
        () => false
      )
    ) {
      await later.click()
    }

    await expect(later).toBeHidden()
    await expect(page.getByRole('button', { name: 'Workspace', exact: true })).toBeVisible()
    await expect(page.locator('[data-testid="jarvis-home-hero"]')).toBeVisible({ timeout: 60_000 })
    await capture('workspace-office.png')
    await page.locator('[data-jarvis-nav-view="agents"]').click()
    await expect(page.getByRole('heading', { name: 'Twoje biuro agentów' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Maja · Marketing' })).toBeVisible()
    await capture('agents-office.png')
    await page.getByRole('button', { name: 'Utwórz własnego agenta' }).click()
    await page.getByLabel('Nazwa agenta').fill('Ada testowa')
    await page.getByLabel('Instrukcje agenta').fill('Pomagaj przygotować plan. Pytaj o brakujące terminy.')
    await page.getByRole('button', { name: 'Avatar Iga' }).click()
    await capture('agent-editor.png')
    await page.getByRole('button', { name: 'Zapisz rolę' }).click()
    await expect(page.getByRole('heading', { name: 'Ada testowa' })).toBeVisible()
    await page.getByRole('button', { name: 'Nauka AI', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Zrozum AI. Pracuj pewniej.' })).toBeVisible()
    await capture('learn-ai.png')
    await page.getByRole('button', { name: 'Słownik AI' }).click()
    await page.getByLabel('Szukaj pojęcia').fill('OAuth')
    await expect(page.getByText('OAuth', { exact: true })).toBeVisible()
    await page.locator('[data-jarvis-nav-view="settings"]').click()
    await page.locator('[data-tour="nav-config:appearance"]').click()
    await expect(page.getByRole('heading', { name: 'Twój profil i styl współpracy' })).toBeVisible()
    await capture('settings-profile.png')
    await page.locator('[data-tour="nav-config:voice"]').click()
    await capture('settings-voice.png')
    await page.getByText('Więcej ustawień głosu', { exact: true }).click()
    await page.locator('[id="setting-field-voice.realtime.gemini.model"]').scrollIntoViewIfNeeded()
    await capture('settings-live-model.png')
    await page.locator('[data-tour="nav-providers"]').click()
    await capture('settings-providers.png')
    await page.locator('[data-jarvis-nav-view="connections"]').click()
    await capture('integrations-office.png')
  } finally {
    await fixture.cleanup()
  }
})
