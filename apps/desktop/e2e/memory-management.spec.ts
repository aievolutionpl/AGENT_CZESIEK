import fs from 'node:fs'
import path from 'node:path'

import { type MockBackendFixture, setupMockBackend, waitForAppReady } from './fixtures'
import { expect, test } from './test'

let fixture: MockBackendFixture | null = null

test.beforeAll(async () => {
  fixture = await setupMockBackend()
  const memories = path.join(fixture.sandbox.hermesHome, 'memories')
  const skills = path.join(fixture.sandbox.hermesHome, 'skills')
  const releaseSkill = path.join(skills, 'release', 'release-checklist')
  fs.mkdirSync(memories, { recursive: true })
  fs.mkdirSync(releaseSkill, { recursive: true })
  fs.writeFileSync(path.join(memories, 'USER.md'), 'Remember the release checklist\nVerify the release before publishing.\n')
  fs.writeFileSync(path.join(releaseSkill, 'SKILL.md'), '---\nname: Release checklist\ndescription: Verify releases\ncategory: release\n---\nCheck the release result.\n')
  fs.writeFileSync(path.join(skills, '.usage.json'), JSON.stringify({ 'Release checklist': { use_count: 2 } }))
  await waitForAppReady(fixture, 120_000)
  await fixture.page.goto(`${fixture.page.url().split('#')[0]}#/starmap?view=graph`)
  await expect(fixture.page.locator('canvas')).toBeVisible({ timeout: 30_000 })
})

test.afterAll(async () => {
  await fixture?.cleanup()
  fixture = null
})

test('memory graph keeps 2D rendering and exposes a searchable list', async () => {
  const page = fixture!.page
  await expect(page.getByRole('button', { name: 'Reset view' })).toBeVisible()
  expect(await page.locator('canvas').evaluate(element => Boolean((element as HTMLCanvasElement).getContext('2d')))).toBe(true)
  await page.getByRole('button', { name: 'Memory', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Memory', exact: true }).getByRole('list')).toBeVisible()
  await page.getByRole('textbox', { name: 'Search memory' }).fill('release')
  await expect(page.getByRole('button', { name: 'Remember the release checklist', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Remember the release checklist', exact: true }).click()
  await expect(page.getByRole('article', { name: /Memory details for Remember/ })).toContainText('Verify the release before publishing.')
})
