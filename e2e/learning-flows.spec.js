import { expect, test } from '@playwright/test'
import { lessons } from '../src/data/curriculum.js'

const storageKey = 'spring-reactor-snapshot-v1'
const lessonId = 'spring-vs-boot'
const practiceLesson = lessons.find((lesson) => lesson.id === 'java-class')

function checkpointAnswer(question) {
  if (question === practiceLesson.question) return practiceLesson.options[practiceLesson.answer]
  const codeFragment = question.match(/^Kod\/model okuma: `(.+?)`/u)?.[1]
  if (codeFragment) return practiceLesson.codeNotes.find(([fragment]) => fragment === codeFragment)?.[1]
  const concept = question.match(/^Kavram ayrımı: `(.+?)`/u)?.[1]
  if (concept) return practiceLesson.terms.find(([term]) => term === concept)?.[1]
  throw new Error(`Unknown checkpoint question: ${question}`)
}

async function openLearningPhase(page, phase) {
  await page.locator('.learning-phase-nav button').nth(phase).click()
  await expect(page.locator('.guided-phase').nth(phase)).toBeVisible()
}

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

test('a real Java lesson retains code work, spaced retry and mastery after reload', async ({ page }) => {
  await page.goto('?lesson=java-class')
  await expect(page).toHaveTitle(/Class, field ve object/)
  await openLearningPhase(page, 1)

  const codeWorkout = page.locator('.code-workout')
  await codeWorkout.getByRole('textbox', { name: /kod editörü/ }).fill(`class Product {
  String name;
  double price;
}

class Demo {
  void run() {
    Product phone = new Product();
    phone.name = "Telefon";
    phone.price = 1299.0;
  }
}`)
  await codeWorkout.getByRole('button', { name: 'Kodu kontrol et' }).click()
  await expect(codeWorkout).toContainText('✓ TAMAMLANDI')
  await expect.poll(async () => (await storedProgress(page))?.learning?.[practiceLesson.id]?.codePassed).toBe(true)
  expect((await storedProgress(page)).completed).not.toContain(practiceLesson.id)

  await openLearningPhase(page, 2)
  const quiz = page.locator('.quiz-card')
  await expect(quiz.locator('h3')).toHaveText(practiceLesson.question)
  const correctText = checkpointAnswer(await quiz.locator('h3').innerText())
  const wrong = quiz.locator('.quiz-options button').filter({ hasNotText: correctText }).first()
  await wrong.click()
  await expect(quiz.locator('.quiz-feedback')).toContainText('Neden yanlış?')
  await expect.poll(async () => (await storedProgress(page))?.learning?.[practiceLesson.id]?.masteryCheckpoint?.retryAttempts?.['java-class-main']).toBe(1)
  expect((await storedProgress(page)).completed).not.toContain(practiceLesson.id)

  await page.reload()
  await openLearningPhase(page, 2)
  await expect(quiz.locator('.retry-badge', { hasText: 'TEKRAR' })).toBeVisible()

  for (let index = 0; index < 3; index += 1) {
    const question = await quiz.locator('h3').innerText()
    const answer = question.startsWith('Kod/model okuma:') || question.startsWith('Kavram ayrımı:') || question === practiceLesson.question
      ? checkpointAnswer(question)
      : null
    // A retry reverses the wording; its correct concept remains visible in the lesson material.
    const retryAnswer = question.startsWith('“')
      ? practiceLesson.terms.find(([, meaning]) => question.includes(meaning))?.[0]
        ?? practiceLesson.codeNotes.find(([, explanation]) => question.includes(explanation))?.[0]
      : question.match(/^`(.+?)` bu derste ne anlatıyor\?/u)
        ? practiceLesson.codeNotes.find(([fragment]) => question.includes(`\`${fragment}\``))?.[1]
      : null
    const expected = answer ?? retryAnswer
    expect(expected, `Missing answer fixture for ${question}`).toBeTruthy()
    await quiz.locator('.quiz-options button').filter({ hasText: expected }).click()
    await expect(quiz.locator('.quiz-feedback')).toContainText('Doğru.')
    if (index < 2) await quiz.getByRole('button', { name: 'Sonraki soru →' }).click()
  }

  await expect(quiz.locator('.mastery-result')).toContainText('Ders tamamlandı')
  await expect.poll(async () => (await storedProgress(page))?.completed?.includes(practiceLesson.id)).toBe(true)
  const progress = await storedProgress(page)
  expect(progress.learning[practiceLesson.id].masteryCheckpoint.masteredConceptIds).toHaveLength(3)
  expect(progress.learning[practiceLesson.id].completionEvidenceVersion).toBe(2)
  expect(progress.learning[practiceLesson.id].masteredAt).toBeGreaterThan(0)

  await page.reload()
  await openLearningPhase(page, 2)
  await expect(quiz.locator('.mastery-result')).toContainText('Ders tamamlandı')
  await expect(page.locator('.lesson-link.active')).toContainText('tamamlandı')
  expect((await storedProgress(page)).completed).toContain(practiceLesson.id)
})

test('unfinished Java code draft autosaves and returns after reload', async ({ page }) => {
  await page.goto('?lesson=java-class')
  await openLearningPhase(page, 1)

  const editor = page.locator('.code-workout').getByRole('textbox', { name: /kod editörü/ })
  const draft = 'class Product {\n  String name;\n  // Henüz bitmedi\n}'
  await editor.fill(draft)
  await expect.poll(async () => (await storedProgress(page))?.learning?.['java-class']?.codeDraft).toBe(draft)
  const saved = (await storedProgress(page)).learning['java-class']
  expect(saved.codeDraftUpdatedAt).toBeGreaterThan(0)
  expect(saved.codePassed).not.toBe(true)

  await page.reload()
  await openLearningPhase(page, 1)
  await expect(editor).toHaveValue(draft)
  await expect(editor).toHaveAttribute('maxlength', '20000')
})

test('code editor keyboard shortcuts expose an accessible exit and feedback', async ({ page }) => {
  await page.goto('?lesson=java-class')
  await openLearningPhase(page, 1)

  const workout = page.locator('.code-workout')
  const editor = workout.getByRole('textbox', { name: /kod editörü/ })
  const helpId = await editor.getAttribute('aria-describedby')
  expect(helpId).toBeTruthy()
  const help = page.locator(`[id="${helpId}"]`)
  await expect(help).toBeVisible()
  await expect(help).toContainText('Esc: düğmelere geç')

  await editor.fill('class Test {}')
  await editor.press('End')
  await editor.press('Tab')
  await expect(editor).toHaveValue('class Test {}  ')
  await expect(editor).toBeFocused()

  await editor.press('Escape')
  await expect(workout.getByRole('button', { name: 'Kodu kontrol et' })).toBeFocused()
  await editor.focus()
  await editor.press('Shift+Tab')
  await expect(editor).not.toBeFocused()
  await editor.focus()
  await editor.press('ControlOrMeta+Enter')
  await expect(workout.getByRole('status')).toContainText('Henüz eksik parça var.')
})

test('Java draft survives a reload immediately after typing', async ({ page }) => {
  await page.goto('?lesson=java-class')
  await openLearningPhase(page, 1)

  const editor = page.locator('.code-workout').getByRole('textbox', { name: /kod editörü/ })
  const draft = 'class Product {\n  String name;\n  // Kaydetmeden hemen yenile\n}'
  await editor.fill(draft)
  expect((await storedProgress(page))?.learning?.['java-class']?.codeDraft).toBe(draft)
  await page.reload()
  await openLearningPhase(page, 1)

  await expect(editor).toHaveValue(draft)
  expect((await storedProgress(page))?.learning?.['java-class']?.codeDraft).toBe(draft)
})

test('Java draft survives immediately leaving and reopening the lesson', async ({ page }) => {
  await page.goto('?lesson=java-class')
  await openLearningPhase(page, 1)

  const editor = page.locator('.code-workout').getByRole('textbox', { name: /kod editörü/ })
  const draft = 'class Product {\n  int stock = 5;\n}'
  await editor.fill(draft)
  await page.goto(`?lesson=${lessonId}`)
  await page.goto('?lesson=java-class')
  await openLearningPhase(page, 1)

  await expect(editor).toHaveValue(draft)
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

test('a stale Java editor cannot overwrite newer progress from another tab', async ({ page, context }) => {
  await page.goto('?lesson=java-class')
  await openLearningPhase(page, 1)
  await expect.poll(async () => Boolean(await storedProgress(page))).toBe(true)

  const otherTab = await context.newPage()
  await otherTab.goto(`?lesson=${lessonId}`)
  const backup = await openBackup(otherTab)
  const updated = await storedProgress(otherTab)
  updated.learning[lessonId] = { attempts: 13 }
  await importBackup(otherTab, backup, updated)

  await expect(page.getByRole('alert')).toContainText('Başka bir sekme ilerlemeni değiştirdi')
  const editor = page.locator('.code-workout').getByRole('textbox', { name: /kod editörü/ })
  await editor.fill('class Product { int stock; }')
  expect((await storedProgress(page)).learning[lessonId].attempts).toBe(13)

  await page.reload()
  await openLearningPhase(page, 1)
  expect((await storedProgress(page)).learning[lessonId].attempts).toBe(13)
  await expect(editor).not.toHaveValue('class Product { int stock; }')
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
