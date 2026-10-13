import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { buildAppEnv, createSandbox, launchDesktop } from './fixtures'
import { expect, test } from './test'

test('voice settings persist the actual conversation provider across reloads', async () => {
  const sandbox = createSandbox('voice-settings')
  writeFileSync(path.join(sandbox.hermesHome, 'config.yaml'), 'display:\n  language: pl\n', 'utf8')
  const { app, page } = await launchDesktop(buildAppEnv(sandbox))
  try {
    await page
      .getByRole('button', { name: /Kliknij logo, aby rozpocząć|Click (?:the )?logo to begin/ })
      .click({ timeout: 60_000 })
    await page.getByRole('button', { name: /Dokończę później|Finish later/ }).click({ timeout: 60_000 })
    await page
      .getByText(/Wybiorę dostawcę później|I'll choose a provider later/, { exact: true })
      .click({ timeout: 60_000 })
    await page.evaluate(() => {
      window.location.hash = '#/settings?tab=config:voice'
    })
    const eleven = page.getByRole('button', { name: /ElevenLabs.*Głosy|ElevenLabs.*Voices/ })
    await expect(eleven).toBeVisible({ timeout: 60_000 })
    await eleven.click()
    await expect(eleven).toHaveAttribute('aria-pressed', 'true')
    await page.waitForTimeout(1500)
    await page.reload()
    await expect(eleven).toHaveAttribute('aria-pressed', 'true', { timeout: 60_000 })
    const openai = page.getByRole('button', { name: /OpenAI Realtime.*Rozmowa|OpenAI Realtime.*Live/ })
    await openai.click()
    await expect(page.getByText(/Subskrypcja ChatGPT i OpenAI API|ChatGPT subscriptions and OpenAI API/)).toBeVisible()
    await page.waitForTimeout(1500)
    await page.reload()
    await expect(openai).toHaveAttribute('aria-pressed', 'true', { timeout: 60_000 })
    await page.getByRole('button', { name: /Gemini Live.*Naturalna|Gemini Live.*Natural/ }).click()
    await expect(page.getByTestId('live-voice-picker')).toBeVisible()
    await expect(page.getByRole('button', { name: /Posłuchaj głosu Puck|Preview the voice Puck/ })).toBeVisible()
    const screenshots = path.resolve('test-results/voice-settings')
    mkdirSync(screenshots, { recursive: true })
    await page.screenshot({ path: path.join(screenshots, 'voice-providers.png') })
  } finally {
    await app.close().catch(() => undefined)
    sandbox.cleanup()
  }
})
