import { mkdirSync } from 'node:fs'
import path from 'node:path'

import type { CDPSession } from '@playwright/test'

import { setupMockBackend, waitForAppReady } from './fixtures'
import { expect, test } from './test'

test('chat and voice controls remain available during worker activity with balanced chat insets', async () => {
  test.setTimeout(180_000)
  const request = 'Przygotuj analizę rynku na jutro'
  const fixture = await setupMockBackend({ language: 'pl', mockServer: { holdFirstStreamForPrompt: request } })
  const { app, page, mock } = fixture
  let cdp: CDPSession | undefined

  try {
    await waitForAppReady(fixture, 120_000, 'pl')
    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()
        .find(window => !window.webContents.getURL().includes('win=overlay'))
        ?.setSize(1440, 1000)
    })
    await page.locator('[data-jarvis-nav-view="jarvis"]').click()
    const folder = path.resolve('test-results/live-workspace')
    mkdirSync(folder, { recursive: true })
    const composer = page.locator('[contenteditable="true"]').first()
    await expect(composer).toBeVisible({ timeout: 120_000 })
    await page.screenshot({ path: path.join(folder, 'workspace-chat-spacing.png'), animations: 'disabled' })
    await composer.click()
    await composer.type(request)
    await composer.press('Enter')
    await mock.waitForHeldStream()
    await expect(
      page.getByTestId('jarvis-voice-controls').getByRole('button', { name: 'Zacznij rozmowę', exact: true })
    ).toBeEnabled()
    await composer.click()
    await composer.type('Omówmy kolejny krok, kiedy Hermes pracuje')
    await expect(composer).toContainText('Omówmy kolejny krok, kiedy Hermes pracuje')

    const session = await app.context().newCDPSession(page)
    cdp = session

    for (const width of [390, 1440, 1920]) {
      await session.send('Emulation.setDeviceMetricsOverride', {
        width,
        height: 1000,
        deviceScaleFactor: 1,
        mobile: false
      })
      await expect.poll(() => page.evaluate(() => innerWidth)).toBe(width)

      const geometry = await page.evaluate(() => {
        const frame = document.querySelector('[data-jarvis-chat-frame]')!.getBoundingClientRect()
        const surface = document.querySelector('[data-jarvis-chat-frame] [data-chat-surface]')!.getBoundingClientRect()
        const input = document.querySelector('[data-slot="composer-surface"]')!.getBoundingClientRect()

        return {
          bottom: frame.bottom - surface.bottom,
          side: frame.right - surface.right,
          center: Math.abs(frame.left + frame.right - (surface.left + surface.right)),
          inputRight: surface.right - input.right,
          inputBottom: surface.bottom - input.bottom,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
        }
      })

      expect(geometry.side).toBeGreaterThanOrEqual(width <= 640 ? 7 : 9)
      expect(geometry.bottom).toBeGreaterThanOrEqual(width <= 640 ? 11 : 19)
      expect(geometry.center).toBeLessThanOrEqual(2)
      expect(geometry.inputRight).toBeGreaterThanOrEqual(8)
      expect(geometry.inputBottom).toBeGreaterThanOrEqual(5)
      expect(geometry.overflow).toBeLessThanOrEqual(1)
      await page.screenshot({ path: path.join(folder, `chat-spacing-${width}.png`), animations: 'disabled' })
    }

    mock.releaseHeldStream()
    await expect(page.getByText(/Hello from the mock inference server/).first()).toBeVisible({ timeout: 60_000 })
    await session.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false
    })
    await expect.poll(() => page.evaluate(() => innerWidth)).toBe(1440)
    await page.screenshot({ path: path.join(folder, 'working-chat-spacing.png'), animations: 'disabled' })
  } finally {
    mock.releaseHeldStream()
    await cdp?.detach().catch(() => undefined)
    await fixture.cleanup()
  }
})
