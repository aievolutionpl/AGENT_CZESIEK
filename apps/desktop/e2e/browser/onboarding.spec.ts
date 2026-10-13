import { expect, test } from '@playwright/test'

// Real Chromium, real wizard and API helpers; mock-only provider bridge, no live keys.
test('mock-only successful key validation/save/catalog reload persists model selections', async ({ page }) => {
  await page.goto('/e2e/browser/onboarding.html')
  await page.getByLabel('OpenRouter API key').fill('mock-only-key')
  await page.getByRole('button', { name: 'Connect', exact: true }).click()
  await expect(page.locator('[aria-current="step"]')).toContainText('Model')
  expect(await page.evaluate(() => localStorage.getItem('mock-key-saved'))).toBe('true')
  await page.reload()
  await expect(page.locator('[aria-current="step"]')).toContainText('Model')
  expect(
    await page.evaluate(() => Object.values(localStorage).some(value => value.includes('deepseek/deepseek-v4.1-flash')))
  ).toBe(true)
})
for (const scenario of ['invalid', 'offline', 'hung']) {
  test(`mock-only ${scenario} validation recovers and retries`, async ({ page }) => {
    await page.goto(`/e2e/browser/onboarding.html?scenario=${scenario}`)
    await page.getByLabel('OpenRouter API key').fill('mock-only-key')
    await page.getByRole('button', { name: 'Connect', exact: true }).click()
    await expect(page.getByTestId('openrouter-quick-connect').getByRole('alert')).toBeVisible({ timeout: 25_000 })
    await expect(page.getByRole('button', { name: 'Connect', exact: true })).toBeEnabled()
    expect(await page.evaluate(() => localStorage.getItem('mock-key-saved'))).toBe(
      scenario === 'invalid' ? null : 'true'
    )
    await expect(page.locator('[aria-current="step"]')).not.toContainText('Model')
    await page.evaluate(() => localStorage.setItem('mock-mode', 'success'))
    await page.getByRole('button', { name: 'Connect', exact: true }).click()
    await expect(page.locator('[aria-current="step"]')).toContainText('Model')
  })
}
test('all nine steps skip a hung load, preserve choices, and can be configured later', async ({ page }) => {
  await page.goto('/e2e/browser/onboarding.html?scenario=skip')
  const steps = ['welcome', 'profile', 'engine', 'model', 'voice', 'access', 'computer', 'connections', 'approvals']
  for (const step of steps) {
    const state = await page.evaluate(
      () =>
        Object.entries(localStorage)
          .filter(([key]) => key.startsWith('ai-evolution-jarvis-onboarding-v1'))
          .map(([, value]) => JSON.parse(value))[0]
    )
    expect(state.currentStep).toBe(step)
    expect(state.completedSteps).toEqual([])
    await expect(page.locator('[aria-current="step"]')).toHaveCount(1)
    await page.getByRole('button', { name: 'Skip this step', exact: true }).click()
  }
  await expect(page.getByTestId('jarvis-onboarding')).toHaveCount(0)
  expect(await page.evaluate(() => document.body.dataset.dismissed)).toBe('true')
  const state = await page.evaluate(
    () =>
      Object.entries(localStorage)
        .filter(([key]) => key.startsWith('ai-evolution-jarvis-onboarding-v1'))
        .map(([, value]) => JSON.parse(value))[0]
  )
  expect(state.skipped).toBe(true)
  expect(state.completedSteps).toEqual([])
  await page.reload()
  await expect(page.getByRole('button', { name: 'Skip this step', exact: true })).toBeVisible()
})
test('skip a hanging key validation ignores late connection intent', async ({ page }) => {
  await page.goto('/e2e/browser/onboarding.html?scenario=hung')
  await page.getByLabel('OpenRouter API key').fill('mock-only-key')
  await page.getByRole('button', { name: 'Connect', exact: true }).click()
  await page.getByRole('button', { name: 'Skip this step', exact: true }).click()
  await expect(page.locator('[aria-current="step"]')).toContainText('Model')
  expect(await page.evaluate(() => localStorage.getItem('mock-key-saved'))).toBeNull()
})
