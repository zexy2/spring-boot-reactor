import { expect, test } from '@playwright/test'

const storageKey = 'spring-reactor-snapshot-v1'
const lessonId = 'spring-vs-boot'

async function openBackup(page) {
  const mobileToggle = page.getByRole('button', { name: /Konu haritası/ })
  if (await mobileToggle.isVisible()) await mobileToggle.click()
  const backup = page.locator('.roadmap-intro .progress-backup')
  await backup.locator('summary').click()
  return backup
}

async function storedProgress(page) {
  return page.evaluate((key) => {
    const value = localStorage.getItem(key)
    return value === null ? null : JSON.parse(value)
  }, storageKey)
}

async function importBackup(page, backup, data) {
  await backup.locator('input[type=file]').setInputFiles({
    name: 'learning-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(data)),
  })
  await expect(backup.getByRole('status')).toContainText('birleştirildi')
}

test('opening a lesson link directly and navigating back works', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByRole('main')).toBeVisible()
  await expect(page).toHaveTitle(/Java Backend Öğrenme Atölyesi/)

  await page.goto(`?lesson=${lessonId}`)
  await expect(page).toHaveTitle(/Spring vs Spring Boot/)
  await expect(page.getByRole('main')).toContainText('Spring Boot')
  await page.goBack()
  await expect(page).toHaveURL(/spring-boot-reactor\/$/)
})

test('JSON backup can be downloaded, imported and retained after refresh', async ({ page }) => {
  await page.goto('./')
  const backup = await openBackup(page)
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    backup.getByRole('button', { name: 'JSON indir' }).click(),
  ])
  expect(download.suggestedFilename()).toMatch(/^java-backend-ilerleme-.*\.json$/)

  await expect.poll(async () => Boolean(await storedProgress(page))).toBe(true)
  const data = await storedProgress(page)
  data.learning[lessonId] = { attempts: 5 }
  await importBackup(page, backup, data)
  await expect.poll(async () => (await storedProgress(page))?.learning[lessonId]?.attempts).toBe(5)

  await page.reload()
  await expect.poll(async () => (await storedProgress(page))?.learning[lessonId]?.attempts).toBe(5)
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('invalid JSON backup is rejected without changing saved progress', async ({ page }) => {
  await page.goto('./')
  const backup = await openBackup(page)
  await expect.poll(async () => Boolean(await storedProgress(page))).toBe(true)
  const before = await page.evaluate((key) => localStorage.getItem(key), storageKey)

  await backup.locator('input[type=file]').setInputFiles({
    name: 'broken-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{broken'),
  })

  await expect(backup.getByRole('status')).toContainText('Dosya geçerli JSON değil.')
  expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBe(before)
})

test('another tab saving progress locks the stale tab until refresh', async ({ page, context }) => {
  await page.goto('./')
  await expect.poll(async () => Boolean(await storedProgress(page))).toBe(true)
  const older = await storedProgress(page)

  const otherTab = await context.newPage()
  await otherTab.goto('./')
  const backup = await openBackup(otherTab)
  const updated = await storedProgress(otherTab)
  updated.learning[lessonId] = { attempts: 7 }
  await importBackup(otherTab, backup, updated)

  await expect(page.getByRole('alert')).toContainText('Başka bir sekme ilerlemeni değiştirdi')
  const conflictBackup = page.getByRole('alert').locator('.progress-backup')
  await conflictBackup.locator('summary').click()
  await expect(conflictBackup.getByRole('button', { name: 'JSON indir' })).toBeVisible()
  await expect(conflictBackup.locator('input[type=file]')).toHaveCount(0)
  expect(older.learning[lessonId]?.attempts).not.toBe(7)
  expect((await storedProgress(page)).learning[lessonId].attempts).toBe(7)

  await page.reload()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect.poll(async () => (await storedProgress(page))?.learning[lessonId]?.attempts).toBe(7)
})

test('small mobile viewports avoid page-wide horizontal overflow', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'Dedicated mobile regression')
  for (const width of [320, 375, 400]) {
    await page.setViewportSize({ width, height: 780 })
    await page.goto('./')
    await expect(page.getByRole('main')).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow, `Unexpected horizontal overflow at ${width}px`).toBeLessThanOrEqual(1)
  }
})
