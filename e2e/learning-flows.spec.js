import { expect, test } from '@playwright/test'
import { lessons } from '../src/data/curriculum.js'
import { codePracticeLibrary } from '../src/learning/codePractice.js'

// CodeMirror is contenteditable with an offscreen, virtualized document.
const codeValue = (editor) => editor.evaluate((element) => element.closest('.cm-editor').__getCodeDraft())
const expectCode = (editor, expected) => expect.poll(() => codeValue(editor)).toBe(expected)

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
  await expectCode(editor, draft)
  await expect(editor).toHaveAttribute('data-maxlength', '20000')
})

test('Java requirements update only on submission and reset after editing', async ({ page }) => {
  await page.goto('?lesson=java-class')
  await openLearningPhase(page, 1)
  const workout = page.locator('.code-workout')
  const editor = workout.getByRole('textbox', { name: /kod editörü/ })
  const requirements = workout.locator('.code-requirements')
  await editor.fill('class Product {}')
  await expect(requirements.locator('.missing')).toHaveCount(0)

  await workout.getByRole('button', { name: 'Kodu kontrol et' }).click()
  await expect(requirements.locator('.missing').first()).toBeVisible()
  await expect(workout.locator('.code-workout-feedback')).toBeVisible()

  await editor.fill(`class Product { String name; double price; }
class Demo { void run() {
  Product phone = new Product();
  phone.name = "Telefon";
  phone.price = 1299.0;
} }`)
  await expect(requirements.locator('.missing')).toHaveCount(0)
  await expect(workout.locator('.code-workout-feedback')).toHaveCount(0)

  await workout.getByRole('button', { name: 'Kodu kontrol et' }).click()
  await expect(workout).toContainText('✓ TAMAMLANDI')
  await expect(requirements.locator('.missing')).toHaveCount(0)
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
  await expect(help).toContainText('Esc: editörden çık')

  await editor.fill('')
  await expect(workout.getByRole('button', { name: 'Kodu kontrol et' })).toBeDisabled()
  await editor.press('Escape')
  await expect(workout.getByRole('group', { name: 'Kod çalışması eylemleri' })).toBeFocused()
  await expect(workout.getByRole('group', { name: 'Kod çalışması eylemleri' })).toHaveCSS('outline-style', 'solid')
  await expect(workout.getByRole('button', { name: 'Örnek çözümü göster' })).not.toBeFocused()
  await editor.focus()

  await editor.fill('class Test {}')
  await editor.press('End')
  await editor.press('Tab')
  await expectCode(editor, 'class Test {}  ')
  await expect(editor).toBeFocused()

  await editor.press('Escape')
  await expect(workout.getByRole('button', { name: 'Kodu kontrol et' })).toBeFocused()
  await editor.focus()
  await editor.press('Shift+Tab')
  await expect(editor).not.toBeFocused()
  await editor.focus()
  await editor.press('ControlOrMeta+Enter')
  await expect(workout.getByRole('status')).toContainText('Java sözdizimi geçerli, görev eksik.')
})

test('indentation keeps selected code and skips a line outside the selection', async ({ page }) => {
  await page.goto('?lesson=java-class')
  await openLearningPhase(page, 1)

  const editor = page.locator('.code-workout').getByRole('textbox', { name: /kod editörü/ })
  const initial = 'class Test {\n  int a;\n  int b;\n}'
  await editor.fill(initial)
  await editor.evaluate((element) => element.closest('.cm-editor').__selectCodeRange(0, 'class Test {\n  int a;\n'.length))
  await editor.press('Tab')

  const expected = '  class Test {\n    int a;\n  int b;\n}'
  await expectCode(editor, expected)
  await expect(editor).toBeFocused()
  await expect.poll(async () => (await storedProgress(page))?.learning?.['java-class']?.codeDraft).toBe(expected)
  const selection = await editor.evaluate((element) => element.closest('.cm-editor').__codeSelection())
  expect(selection).toEqual([0, '  class Test {\n    int a;\n'.length])

  await editor.press('ControlOrMeta+z')
  await expectCode(editor, initial)
  await expect.poll(async () => (await storedProgress(page))?.learning?.['java-class']?.codeDraft).toBe(initial)
})

test('code editor Tab indentation can be undone and stays in sync with the saved draft', async ({ page }) => {
  await page.goto('?lesson=java-class')
  await openLearningPhase(page, 1)

  const editor = page.locator('.code-workout').getByRole('textbox', { name: /kod editörü/ })
  const initial = 'class Test {}'
  await editor.fill(initial)
  await editor.press('End')
  await editor.press('Tab')
  await expectCode(editor, `${initial}  `)

  await editor.press('ControlOrMeta+z')
  await expectCode(editor, initial)
  await expect.poll(async () => (await storedProgress(page))?.learning?.['java-class']?.codeDraft).toBe(initial)

  await editor.press('ControlOrMeta+Shift+z')
  await expectCode(editor, `${initial}  `)
  await expect.poll(async () => (await storedProgress(page))?.learning?.['java-class']?.codeDraft).toBe(`${initial}  `)
})

test('code editor line numbers track added and removed lines without losing the draft', async ({ page }) => {
  await page.goto('?lesson=java-class')
  await openLearningPhase(page, 1)

  const editor = page.locator('.code-workout').getByRole('textbox', { name: /kod editörü/ })
  const gutter = page.locator('.code-workout .cm-lineNumbers')

  await editor.fill('class A {}')
  await expect.poll(() => gutter.locator('.cm-gutterElement').allTextContents()).toContain('1')
  const multiline = 'class A {\n  int count;\n}\n'
  await editor.fill(multiline)
  await expect.poll(() => gutter.locator('.cm-gutterElement').allTextContents()).toEqual(expect.arrayContaining(['1', '2', '3', '4']))
  await expect.poll(async () => (await storedProgress(page))?.learning?.['java-class']?.codeDraft).toBe(multiline)

  await editor.fill('class A {}')
  await expect.poll(() => gutter.locator('.cm-gutterElement').allTextContents()).toContain('1')
  await page.reload()
  await openLearningPhase(page, 1)
  await expectCode(editor, 'class A {}')
  await expect.poll(() => gutter.locator('.cm-gutterElement').allTextContents()).toContain('1')
})

test('Java syntax and missing requirements are checked separately before recording progress', async ({ page }) => {
  // External font CSS can delay the load event; React readiness is asserted below.
  await page.goto('?lesson=java-class', { waitUntil: 'domcontentloaded' })
  await openLearningPhase(page, 1)

  const workout = page.locator('.code-workout')
  const editor = workout.getByRole('textbox', { name: /kod editörü/ })
  const feedback = workout.getByRole('status')
  const requirements = workout.locator('.code-requirements')

  await editor.fill('class Product { String name;')
  await workout.getByRole('button', { name: 'Kodu kontrol et' }).click()
  await expect(feedback).toContainText('Java sözdizimi hatası ve eksik şartlar var.')
  await expect(requirements).toContainText('× Java sözdizimi')
  await expect(requirements).toContainText('× double price field’ı')
  expect((await storedProgress(page))?.learning?.['java-class']?.codePassed).not.toBe(true)

  await editor.fill('class Product { String name; void run() { int x = ; } }')
  await workout.getByRole('button', { name: 'Kodu kontrol et' }).click()
  await expect(feedback).toContainText(/\d+\. satır, \d+\. sütun civarında Java sözdizimi hatası/)

  await editor.fill('class Product { String name; }')
  await expect(feedback).toHaveCount(0)
  await workout.getByRole('button', { name: 'Kodu kontrol et' }).click()
  await expect(feedback).toContainText('Java sözdizimi geçerli, görev eksik.')
  await expect(feedback).toContainText('Eksik şartlar:')
  await expect(requirements).toContainText('✓ Java sözdizimi')
  expect((await storedProgress(page))?.learning?.['java-class']?.codePassed).not.toBe(true)

  await editor.fill(`${codePracticeLibrary['java-class'].solution}\n@@@`)
  expect(await workout.locator('.cm-editor').evaluate((node) => node.__getCodeDraft()))
    .toBe(`${codePracticeLibrary['java-class'].solution}\n@@@`)
  await workout.getByRole('button', { name: 'Kodu kontrol et' }).click()
  await expect(feedback).toContainText('Java sözdizimi hatası var.')
  await expect(requirements).toContainText('× Java sözdizimi')
  expect((await storedProgress(page))?.learning?.['java-class']?.codePassed).not.toBe(true)

  // CodeMirror virtualizes its contenteditable DOM. Exercise the real user's
  // select-all + replacement path instead of Playwright's DOM-only fill range.
  await editor.focus()
  await editor.press('ControlOrMeta+a')
  expect(await workout.locator('.cm-editor').evaluate((node) => node.__codeSelection()))
    .toEqual([0, `${codePracticeLibrary['java-class'].solution}\n@@@`.length])
  await page.keyboard.insertText(codePracticeLibrary['java-class'].solution)
  expect(await workout.locator('.cm-editor').evaluate((node) => node.__getCodeDraft()))
    .toBe(codePracticeLibrary['java-class'].solution)
  await workout.getByRole('button', { name: 'Kodu kontrol et' }).click()
  await expect(feedback).toContainText('Java sözdizimi geçerli.')
  await expect(workout).toContainText('✓ TAMAMLANDI')
  await expect.poll(async () => (await storedProgress(page))?.learning?.['java-class']?.codePassed).toBe(true)
})

test('browser without Web Worker reports verification unavailable, not invalid Java', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'Worker', {
      configurable: true,
      value: class UnavailableWorker {
        constructor() { throw new Error('Worker blocked in this browser') }
      },
    })
  })
  await page.goto('?lesson=java-class')
  await openLearningPhase(page, 1)

  const workout = page.locator('.code-workout')
  await workout.getByRole('textbox', { name: /kod editörü/ }).fill(codePracticeLibrary['java-class'].solution)
  await workout.getByRole('button', { name: 'Kodu kontrol et' }).click()
  await expect(workout.getByRole('status')).toContainText('Java sözdizimi kontrol edilemedi.')
  await expect(workout.getByRole('status')).toContainText('henüz doğrulanmadı')
  await expect(workout.locator('.code-requirements')).toContainText('? Java sözdizimi')
  await expect(workout).not.toContainText('✓ TAMAMLANDI')
  expect((await storedProgress(page))?.learning?.['java-class']?.codePassed).not.toBe(true)
})

test('late Java syntax response cannot mark an edited answer complete', async ({ page }) => {
  // A controlled worker makes a delayed reply deterministic without relying on
  // browser-specific interception of module-worker network requests.
  await page.addInitScript(() => {
    const waiting = []
    window.__javaSyntaxTest = {
      count: () => waiting.length,
      respond: (ok) => {
        const { instance, id } = waiting.shift()
        instance.onmessage({ data: { id, ok } })
      },
    }
    window.Worker = class DelayedWorker {
      postMessage({ id }) { waiting.push({ instance: this, id }) }
      terminate() {}
    }
  })
  await page.goto('?lesson=java-class', { waitUntil: 'domcontentloaded' })
  await openLearningPhase(page, 1)
  const workout = page.locator('.code-workout')
  const editor = workout.getByRole('textbox', { name: /kod editörü/ })

  await editor.fill(codePracticeLibrary['java-class'].solution)
  await workout.getByRole('button', { name: 'Kodu kontrol et' }).click()
  await expect(workout.getByRole('status')).toContainText('Java sözdizimi kontrol ediliyor')
  await expect.poll(() => page.evaluate(() => window.__javaSyntaxTest.count())).toBe(1)
  // Use CodeMirror's own selection/insert flow. Playwright's DOM-based fill()
  // occasionally appends to a virtualized contenteditable on mobile.
  await editor.press('ControlOrMeta+A')
  await page.keyboard.insertText('class Product { String name; }')
  await expectCode(editor, 'class Product { String name; }')
  await page.evaluate(() => window.__javaSyntaxTest.respond(true))

  await expect(workout.getByRole('status')).toHaveCount(0)
  await expect(workout).not.toContainText('✓ TAMAMLANDI')
  expect((await storedProgress(page))?.learning?.['java-class']?.codePassed).not.toBe(true)
  await workout.getByRole('button', { name: 'Kodu kontrol et' }).click()
  await expectCode(editor, 'class Product { String name; }')
  await expect.poll(() => page.evaluate(() => window.__javaSyntaxTest.count())).toBe(1)
  await page.evaluate(() => window.__javaSyntaxTest.respond(true))
  await expect(workout.getByRole('status')).toContainText('Java sözdizimi geçerli, görev eksik.')
  expect((await storedProgress(page))?.learning?.['java-class']?.codePassed).not.toBe(true)
})

test('code editor does not accept required Java code hidden inside string literals', async ({ page }) => {
  await page.goto('?lesson=java-class')
  await openLearningPhase(page, 1)

  const workout = page.locator('.code-workout')
  const challenge = codePracticeLibrary['java-class']
  const fakeAnswer = `${challenge.solution.replace('class Product {', 'class ProductDraft {')}\nclass Notes { String fake = "class Product {"; }`
  await workout.getByRole('textbox', { name: /kod editörü/ }).fill(fakeAnswer)
  await workout.getByRole('button', { name: 'Kodu kontrol et' }).click()

  await expect(workout.getByRole('status')).toContainText('Java sözdizimi geçerli, görev eksik.')
  await expect(workout.locator('.code-requirements')).toContainText('× Product class’ı')
  await expect(workout).not.toContainText('✓ TAMAMLANDI')
})

test('code editor rejects a field assignment faked inside a Java string', async ({ page }) => {
  await page.goto('?lesson=java-class')
  await openLearningPhase(page, 1)

  const workout = page.locator('.code-workout')
  const forged = codePracticeLibrary['java-class'].solution.replace(
    'phone.price = 1299.0;',
    'String fake = "phone.price = 1299.0;";',
  )
  await workout.getByRole('textbox', { name: /kod editörü/ }).fill(forged)
  await workout.getByRole('button', { name: 'Kodu kontrol et' }).click()

  await expect(workout.getByRole('status')).toContainText('Java sözdizimi geçerli, görev eksik.')
  await expect(workout.locator('.code-requirements')).toContainText('× phone field atamaları')
  await expect(workout).not.toContainText('✓ TAMAMLANDI')
})

test('code editor requires Product fields in Product rather than a nested class', async ({ page }) => {
  await page.goto('?lesson=java-class')
  await openLearningPhase(page, 1)

  const workout = page.locator('.code-workout')
  const fakeAnswer = codePracticeLibrary['java-class'].solution.replace(
    '  String name;\n  double price;',
    '  class Nested { String name; double price; }',
  )
  await workout.getByRole('textbox', { name: /kod editörü/ }).fill(fakeAnswer)
  await workout.getByRole('button', { name: 'Kodu kontrol et' }).click()

  await expect(workout.getByRole('status')).toContainText('Java sözdizimi geçerli, görev eksik.')
  await expect(workout.locator('.code-requirements')).toContainText('× name ve price, Product sınıfında')
  await expect(workout).not.toContainText('✓ TAMAMLANDI')
})

test('collections challenge rejects valid code copied into a different class', async ({ page }) => {
  await page.goto('?lesson=java-collections')
  await openLearningPhase(page, 1)

  const workout = page.locator('.code-workout')
  const wrongClass = codePracticeLibrary['java-collections'].solution.replace(
    'class Directory {', 'class OtherDirectory {',
  ) + '\nclass Directory { void example() {} }'
  await workout.getByRole('textbox', { name: /kod editörü/ }).fill(wrongClass)
  await workout.getByRole('button', { name: 'Kodu kontrol et' }).click()

  await expect(workout.getByRole('status')).toContainText('Java sözdizimi geçerli, görev eksik.')
  await expect(workout.locator('.code-requirements')).toContainText('× Koleksiyon işlemleri Directory.example() içinde')
  await expect(workout).not.toContainText('✓ TAMAMLANDI')
})

test('Spring transaction exercise checks debit/credit inside transfer and accepts the corrected flow', async ({ page }) => {
  await page.goto('?lesson=transactions')
  await openLearningPhase(page, 1)

  const workout = page.locator('.code-workout')
  const editor = workout.getByRole('textbox', { name: /kod editörü/ })
  const solution = codePracticeLibrary.transactions.solution
  const wrongOrder = solution.replace(
    '    ledger.debit(fromId, amount);\n    ledger.credit(toId, amount);',
    '    ledger.credit(toId, amount);\n    ledger.debit(fromId, amount);',
  )

  await editor.fill(wrongOrder)
  await expectCode(editor, wrongOrder)
  await workout.getByRole('button', { name: 'Kodu kontrol et' }).click()
  await expect(workout.getByRole('status')).toContainText('Java sözdizimi geçerli, görev eksik.')
  await expect(workout.locator('.code-requirements')).toContainText('× Tutar kontrolü ve debit/credit, TransferService.transfer() içinde ve doğru sırada')
  await expect(workout).not.toContainText('✓ TAMAMLANDI')

  await editor.press('ControlOrMeta+A')
  await page.keyboard.insertText(solution)
  await expectCode(editor, solution)
  await workout.getByRole('button', { name: 'Kodu kontrol et' }).click()
  await expect(workout).toContainText('✓ TAMAMLANDI')
})

test('generated code gap accepts only the missing expression', async ({ page }) => {
  await page.goto('?lesson=spring-vs-boot')
  await openLearningPhase(page, 1)
  const workout = page.locator('.code-workout')
  const editor = workout.getByRole('textbox', { name: /kod editörü/ })
  await expect(workout).toContainText('KOD PARÇASINI TAMAMLA')

  await editor.fill('"@SpringBootApplication"')
  await workout.getByRole('button', { name: 'Kodu kontrol et' }).click()
  await expect(workout.getByRole('status')).toContainText('Henüz eksik parça var.')
  await expect(workout.getByRole('status')).toContainText('yorum veya metin')
  await expect(workout).not.toContainText('✓ TAMAMLANDI')

  await editor.fill('@SpringBootApplication')
  await expect(workout).not.toContainText('✓ TAMAMLANDI')
  await workout.getByRole('button', { name: 'Kodu kontrol et' }).click()
  await expect(workout.getByRole('status')).toContainText('Eksik parçayı doğru tamamladın.')
  await expect(workout).toContainText('✓ TAMAMLANDI')

  await workout.getByRole('button', { name: 'Örnek çözümü göster' }).click()
  await expect(workout.locator('.code-solution')).toContainText('SpringApplication.run')
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

  await expectCode(editor, draft)
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

  await expectCode(editor, draft)
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

test('restoring a newer JSON code draft updates an open editor before the next edit', async ({ page }) => {
  await page.goto('?lesson=java-class')
  await openLearningPhase(page, 1)
  const editor = page.locator('.code-workout').getByRole('textbox', { name: /kod editörü/ })
  await editor.fill('class Product { int oldStock; }')
  const backup = await openBackup(page)
  const imported = await storedProgress(page)
  const restoredDraft = 'class Product {\n  int importedStock;\n}'
  imported.learning['java-class'].codeDraft = restoredDraft
  imported.learning['java-class'].codeDraftUpdatedAt = Date.now() + 60_000

  await importBackup(page, backup, imported)
  await expectCode(editor, restoredDraft)
  await expect.poll(async () => (await storedProgress(page))?.learning?.['java-class']?.codeDraft).toBe(restoredDraft)

  const editedDraft = `${restoredDraft}\n// edited after restore`
  await editor.fill(editedDraft)
  await expect.poll(async () => (await storedProgress(page))?.learning?.['java-class']?.codeDraft).toBe(editedDraft)
  await page.reload()
  await openLearningPhase(page, 1)
  await expectCode(editor, editedDraft)
})

test('delayed autosave cannot rewind a newer Java editor draft', async ({ page }) => {
  await page.goto('?lesson=java-class')
  await openLearningPhase(page, 1)
  const workout = page.locator('.code-workout')
  const editor = workout.getByRole('textbox', { name: /kod editörü/ })
  const firstDraft = codePracticeLibrary['java-class'].solution
  const latestDraft = `${firstDraft}\n@@@`

  await editor.fill(firstDraft)
  await expectCode(editor, firstDraft)
  // Cross the 350 ms app-state debounce while the user is still editing.
  await page.waitForTimeout(300)
  await editor.fill(latestDraft)
  await expectCode(editor, latestDraft)
  await expect.poll(async () => (await storedProgress(page))?.learning?.['java-class']?.codeDraft).toBe(latestDraft)
  await page.waitForTimeout(450)
  await expectCode(editor, latestDraft)

  await workout.getByRole('button', { name: 'Kodu kontrol et' }).click()
  await expect(workout.getByRole('status')).toContainText('Java sözdizimi hatası var.')
  expect((await storedProgress(page))?.learning?.['java-class']?.codePassed).not.toBe(true)
})

test('replacing a JSON backup without a draft clears the open editor', async ({ page }) => {
  await page.goto('?lesson=java-class')
  await openLearningPhase(page, 1)
  const editor = page.locator('.code-workout').getByRole('textbox', { name: /kod editörü/ })
  const starter = await codeValue(editor)
  await editor.fill('class Product { int unsavedStock; }')
  const backup = await openBackup(page)
  const imported = await storedProgress(page)
  delete imported.learning['java-class'].codeDraft
  delete imported.learning['java-class'].codeDraftUpdatedAt
  await backup.getByRole('combobox').selectOption('replace')
  page.once('dialog', (dialog) => dialog.accept())
  await backup.locator('input[type=file]').setInputFiles({
    name: 'replace-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(imported)),
  })

  await expect(backup.getByRole('status')).toContainText('geri yüklendi')
  await expectCode(editor, starter)
  await expect.poll(async () => (await storedProgress(page))?.learning?.['java-class']?.codeDraft).toBeUndefined()
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

test('failed backup persistence does not report a successful import or change progress', async ({ page }) => {
  await page.goto('./')
  const backup = await openBackup(page)
  await expect.poll(async () => Boolean(await storedProgress(page))).toBe(true)
  const before = await page.evaluate((key) => localStorage.getItem(key), storageKey)
  const imported = JSON.parse(before)
  imported.learning[lessonId] = { attempts: 29 }

  await page.evaluate((key) => {
    const originalSetItem = Storage.prototype.setItem
    Storage.prototype.setItem = function (name, value) {
      if (name === key) throw new DOMException('Storage full', 'QuotaExceededError')
      return originalSetItem.call(this, name, value)
    }
  }, storageKey)

  await backup.locator('input[type=file]').setInputFiles({
    name: 'valid-but-no-space.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(imported)),
  })

  await expect(backup.getByRole('status')).toContainText('Tarayıcı kaydı başarısız. İlerleme değiştirilmedi')
  await expect(page.getByRole('alert')).toContainText('İlerleme bu cihazda kaydedilemiyor')
  expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBe(before)
  await page.reload()
  expect((await storedProgress(page)).learning[lessonId]?.attempts).not.toBe(29)
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
  await expect.poll(() => codeValue(editor)).not.toBe('class Product { int stock; }')
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


test('mobile code editor scrolls long code internally without widening the lesson', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'Dedicated mobile editor regression')
  for (const width of [320, 375]) {
    await page.setViewportSize({ width, height: 780 })
    await page.goto('?lesson=java-class')
    await openLearningPhase(page, 1)
    const editor = page.locator('.code-workout').getByRole('textbox', { name: /kod editörü/ })
    const draft = `class Example { String payload = "${'a'.repeat(1500)}"; }`
    await editor.fill(draft)
    await expectCode(editor, draft)
    const bounds = await page.evaluate(() => {
      const scroller = document.querySelector('.code-workout .cm-scroller')
      return {
        pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        editorOverflow: scroller.scrollWidth - scroller.clientWidth,
      }
    })
    expect(bounds.pageOverflow, `Lesson overflow at ${width}px`).toBeLessThanOrEqual(1)
    expect(bounds.editorOverflow, `Long code needs internal scroll at ${width}px`).toBeGreaterThan(0)
    await expect(page.locator('.code-workout').getByRole('button', { name: 'Kodu kontrol et' })).toBeVisible()
  }
})
