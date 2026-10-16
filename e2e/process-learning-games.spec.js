import { expect, test } from '@playwright/test'

async function openApplyPhase(page, lessonId) {
  await page.goto(`?lesson=${lessonId}`)
  await page.locator('.learning-phase-nav button').nth(1).click()
  await expect(page.locator('.guided-phase').nth(1)).toBeVisible()
}

async function expectNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
}

test('requirement discovery reaches a measurable readiness gate', async ({ page }) => {
  await openApplyPhase(page, 'requirement-discovery')
  const game = page.locator('.process-requirement')

  await expect(game).toBeVisible()
  await expect(game.locator('.process-status')).toContainText('4 BELİRSİZLİK KALDI')

  for (const button of await game.locator('.process-question-grid button').all()) await button.click()

  await expect(game.locator('.process-meter')).toContainText('100% NET')
  await expect(game.locator('.process-status')).toContainText('ÇÖZÜM TASARIMINA GEÇ')
  await expectNoHorizontalOverflow(page)
})

test('acceptance criteria builder distinguishes behavior from implementation detail', async ({ page }) => {
  await openApplyPhase(page, 'acceptance-criteria')
  const game = page.locator('.process-acceptance')

  await expect(game).toBeVisible()
  const fields = game.locator('.process-gwt fieldset')
  await expect(fields).toHaveCount(3)

  await fields.nth(0).getByRole('button').first().click()
  await fields.nth(1).getByRole('button').first().click()
  await fields.nth(2).getByRole('button').first().click()

  await expect(game.locator('.process-status')).toContainText('TEST EDİLEBİLİR')
  await expectNoHorizontalOverflow(page)
})

test('sprint planner exposes both over-capacity and off-goal risk', async ({ page }) => {
  await openApplyPhase(page, 'sprint-backlog')
  const game = page.locator('.process-sprint')

  await expect(game.locator('.process-status').last()).toContainText('HEALTHY')

  await game.getByRole('button', { name: /Acil fraud kuralı/ }).click()
  await expect(game.locator('.process-status').last()).toContainText('SCOPE KARARI GEREKİYOR')
  await expect(game.locator('.process-capacity-head .process-status')).toContainText('13/8 PUAN')

  await game.getByRole('button', { name: /Acil fraud kuralı/ }).click()
  await game.getByRole('button', { name: /Order API/ }).click()
  await game.getByRole('button', { name: /Dashboard polish/ }).click()
  await expect(game.locator('.process-status').last()).toContainText('GOAL RİSKİ')
  await expectNoHorizontalOverflow(page)
})

test('incident triage blocks rollback until enough evidence exists', async ({ page }) => {
  await openApplyPhase(page, 'incident-triage')
  const game = page.locator('.process-incident')
  const rollback = game.getByRole('button', { name: 'kontrollü rollback' })

  await expect(rollback).toBeDisabled()
  await game.getByRole('button', { name: /Etkiyi ölç/ }).click()
  await game.getByRole('button', { name: /Başlangıç zamanını bul/ }).click()
  await game.getByRole('button', { name: /Trace’i izle/ }).click()

  await expect(rollback).toBeEnabled()
  await expect(game.locator('.process-status')).toContainText('CHANGE İLİŞKİSİ EKSİK')
  await game.getByRole('button', { name: /Son değişikliği karşılaştır/ }).click()
  await expect(game.locator('.process-status')).toContainText('ROLLBACK SAVUNULABİLİR')
  await rollback.click()
  await expect(rollback).toHaveClass(/selected/)
  await expectNoHorizontalOverflow(page)
})

test('RCA requires reproduction and prevention guards before closure', async ({ page }) => {
  await openApplyPhase(page, 'root-cause-prevention')
  const game = page.locator('.process-rca')
  const reproduce = game.getByRole('button', { name: 'yük testinde hipotezi yeniden üret' })

  await game.getByRole('button', { name: /DNS arızası/ }).click()
  await reproduce.click()
  await expect(game.locator('.process-status').first()).toContainText('HİPOTEZ ÇÜRÜTÜLDÜ')

  await game.getByRole('button', { name: /connection pool = 2/ }).click()
  await reproduce.click()
  await expect(game.locator('.process-status').first()).toContainText('ROOT CAUSE KANITLANDI')

  for (const button of await game.locator('.process-guard-grid button').all()) await button.click()
  await expect(game.locator('.process-status').last()).toContainText('CLOSE WITH LEARNING')
  await expectNoHorizontalOverflow(page)
})

test('process controls remain touch-safe without overflow at 320px', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', '320px regression belongs to mobile coverage')
  await page.setViewportSize({ width: 320, height: 800 })
  await openApplyPhase(page, 'requirement-discovery')

  const game = page.locator('.process-requirement')
  const buttons = game.locator('.process-question-grid button')
  await expect(buttons).toHaveCount(4)
  await expectNoHorizontalOverflow(page)

  const heights = await buttons.evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().height))
  expect(Math.min(...heights)).toBeGreaterThanOrEqual(44)
})
