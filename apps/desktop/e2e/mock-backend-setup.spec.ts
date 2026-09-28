/**
 * E2E tests asserting the mock backend gets the app past the setup/onboarding
 * screen.
 *
 * The mock backend fixture writes a config.yaml with a pre-configured mock
 * provider pointing at a mock inference server. When the app boots, the
 * runtime readiness check should detect the working provider and dismiss the
 * onboarding overlay — landing straight on the chat UI without ever showing
 * the "Let's get you setup with Hermes Agent" screen.
 *
 * If these tests fail, the mock backend config isn't getting the app past
 * onboarding — the chat interaction tests (chat.spec.ts) will also fail
 * because the composer is blocked by the setup overlay.
 *
 * Prerequisite: `npm run build` must have been run so dist/ exists.
 */

import { expect, test } from './test'

import {
  type MockBackendFixture,
  setupMockBackend,
  waitForAppReady,
} from './fixtures'
import { expectVisualSnapshot } from './visual-snapshot'

let fixture: MockBackendFixture | null = null

test.beforeAll(async () => {
  fixture = await setupMockBackend()
  await waitForAppReady(fixture!, 120_000)
})

test.afterAll(async () => {
  await fixture?.cleanup()
  fixture = null
})

test.describe('mock backend gets past setup screen', () => {
  test('onboarding overlay is not shown', async () => {
    const page = fixture!.page

    // The first-run wizard (data-testid="jarvis-onboarding") mounts whenever
    // the active connection + profile has no onboarding record, and its modal
    // dialog-overlay then swallows every click — the composer stays "visible"
    // to Playwright but is never clickable. The fixture records the scope as
    // skipped before the test body runs, so neither may be in the DOM.
    //
    // Asserted by testid, not by the old English copy ("Let's get you setup
    // with Hermes Agent"): the product no longer renders that string, so the
    // text check passed while the wizard was open and blocking.
    await expect(page.locator('[data-testid="jarvis-onboarding"]')).toHaveCount(0)
    await expect(page.locator('[data-slot="dialog-overlay"]')).toHaveCount(0)
  })

  test('chat composer is visible', async () => {
    const page = fixture!.page

    // The composer (contenteditable div) should be visible and not blocked
    // by the onboarding overlay. If the first test passed, the overlay is
    // gone and the composer is the primary interactive surface.
    const composer = page.locator('[contenteditable="true"]').first()
    await expect(composer).toBeVisible()
  })

  test('can type into the composer', async () => {
    const page = fixture!.page

    // If the setup overlay is truly gone, the composer accepts input.
    const composer = page.locator('[contenteditable="true"]').first()
    await composer.click()
    await composer.type('hello mock backend', { delay: 20 })

    // Verify the typed text appears in the DOM.
    await page.waitForFunction(
      () => (document.body.textContent ?? '').includes('hello mock backend'),
      undefined,
      { timeout: 10_000 },
    )
  })

  test('screenshot shows chat UI without setup screen', async () => {
    await expectVisualSnapshot(fixture!.page, { name: 'mock-backend-chat-ready', app: fixture!.app })
  })
})
