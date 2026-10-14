import { expect, test } from '@playwright/test'

const SNAPSHOT_KEY = 'spring-reactor-snapshot-v1'
const codeValue = (editor) => editor.evaluate((node) => node.closest('.cm-editor').__getCodeDraft())
const expectCode = (editor, expected) => expect.poll(() => codeValue(editor)).toBe(expected)

function javaDraft(length) {
  const line = '  int value = 42; // editor latency sample\n'
  const body = line.repeat(Math.ceil(length / line.length)).slice(0, length - 20)
  return `class Benchmark {\n${body}\n}`
}

async function openEditor(page) {
  await page.goto('?lesson=java-class')
  await page.locator('.learning-phase-nav button').nth(1).click()
  const editor = page.locator('.code-workout .cm-content')
  await expect(editor).toBeVisible()
  return editor
}

test('multi-character input replaces a DOM selection before CodeMirror observes it', async ({ page }) => {
  const editor = await openEditor(page)
  const initialDraft = await codeValue(editor)
  const cases = [
    { draft: 'class Replacement { int count = 1; }', selection: [0, 0] },
    { draft: 'class Replacement { int count = 2; }', selection: [5, 10] },
    { draft: `class Replacement {\n${'  int count = 1;\n'.repeat(100)}}`, selection: [0, 0] },
  ]
  for (const { draft, selection: codeSelection } of cases) {
    const eventDetails = await editor.evaluate((content, { replacement, codeSelection: rangeInCode }) => {
      const view = content.closest('.cm-editor')
      view.__selectCodeRange(...rangeInCode)
      const range = document.createRange()
      range.selectNodeContents(content)
      const selection = window.getSelection()
      selection.removeAllRanges()
      selection.addRange(range)
      const previousSelection = view.__codeSelection()
      const selectedText = range.toString()
      const event = new InputEvent('beforeinput', {
        bubbles: true, cancelable: true, inputType: 'insertText', data: replacement,
      })
      content.dispatchEvent(event)
      return { previousSelection, selectedText, prevented: event.defaultPrevented }
    }, { replacement: draft, codeSelection })
    expect(eventDetails.previousSelection).toEqual(codeSelection)
    // DOM Range.toString omits CodeMirror's block line separators.
    expect(eventDetails.selectedText.replace(/\s/g, '')).toBe(initialDraft.replace(/\s/g, ''))
    expect(eventDetails.prevented).toBe(true)
    await expectCode(editor, draft)
    await editor.press('ControlOrMeta+z')
    await expectCode(editor, initialDraft)
  }
})

test('long Java drafts immediately preserve each keystroke and survive reload', async ({ page }) => {
  const editor = await openEditor(page)
  for (const length of [5000, 19000]) {
    const draft = javaDraft(length)
    await editor.fill(draft)
    await expectCode(editor, draft)
    const start = Date.now()
    let expected = draft
    for (const character of 'abcdefghijkl') {
      await editor.pressSequentially(character)
      expected += character
      const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).learning['java-class'].codeDraft, SNAPSHOT_KEY)
      expect(saved).toBe(expected)
    }
    console.log('EDITOR_LONG_DRAFT_METRICS', JSON.stringify({ chars: expected.length, lines: expected.split('\n').length, twelveKeysMs: Date.now() - start }))
    await expectCode(editor, expected)
    await page.reload()
    await page.locator('.learning-phase-nav button').nth(1).click()
    await expectCode(editor, expected)
  }
})

test('virtualized gutter remains bounded after extremely dense paste and scroll', async ({ page }) => {
  const editor = await openEditor(page)
  const lineCount = process.env.EDITOR_STRESS === '1' ? 16000 : 2000
  const draft = `class A {\n${'\n'.repeat(lineCount)}}`
  const start = Date.now()
  await editor.fill(draft)
  const fillMs = Date.now() - start
  await expectCode(editor, draft)
  const gutter = page.locator('.code-workout .cm-lineNumbers')
  // CodeMirror measures and virtualizes the viewport on its next render frame.
  await expect.poll(() => gutter.locator('.cm-gutterElement').count()).toBeLessThan(200)
  const gutterCount = await gutter.locator('.cm-gutterElement').count()
  expect(gutterCount).toBeLessThan(200)
  const scroll = await page.evaluate(() => {
    const element = document.querySelector('.code-workout .cm-scroller')
    element.scrollTop = element.scrollHeight
    return {
      scrollTop: element.scrollTop,
      clientHeight: element.clientHeight,
      contentHeight: element.scrollHeight,
      shellHeight: document.querySelector('.code-editor-shell').clientHeight,
    }
  })
  await expect.poll(() => gutter.locator('.cm-gutterElement').allTextContents()).toContain(String(lineCount + 2))
  console.log('EDITOR_HIGH_LINE_COUNT_METRICS', JSON.stringify({ characters: draft.length, lines: lineCount + 2, gutterCount, fillMs, scroll }))
  expect(scroll.scrollTop).toBeGreaterThan(0)
  expect(scroll.shellHeight).toBeLessThanOrEqual(600)
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).learning['java-class'].codeDraft, SNAPSHOT_KEY)
  expect(saved).toBe(draft)
  await editor.focus()
  await editor.pressSequentially('final')
  await expectCode(editor, `${draft}final`)
})

test('large multiline input supports undo and enforces the draft size limit', async ({ page }) => {
  const editor = await openEditor(page)
  const initialDraft = await codeValue(editor)
  const draft = `class Product {\n${'  int value = 1;\n'.repeat(750)}}`
  expect(draft.length).toBeGreaterThan(1024)
  expect(draft.length).toBeLessThan(20000)

  await editor.fill(draft)
  await expectCode(editor, draft)
  await expect(page.locator('.code-editor-count')).toContainText(`${draft.length.toLocaleString('tr-TR')} / 20.000`)
  await editor.press('ControlOrMeta+z')
  await expectCode(editor, initialDraft)
  await editor.press('ControlOrMeta+Shift+z')
  await expectCode(editor, draft)

  await editor.fill('x'.repeat(20001))
  await expectCode(editor, draft)
  await expect(page.locator('.code-editor-limit-alert')).toContainText('20.000 karakter sınırı')
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).learning['java-class'].codeDraft, SNAPSHOT_KEY)
  expect(saved).toBe(draft)
  await editor.fill('class NewProduct {}')
  await expectCode(editor, 'class NewProduct {}')
  await expect(page.locator('.code-editor-limit-alert')).toHaveCount(0)

  const nearLimit = 'x'.repeat(19999)
  await editor.fill(nearLimit)
  await editor.press('End')
  await editor.press('Tab')
  await expectCode(editor, nearLimit)
  await expect(page.locator('.code-editor-limit-alert')).toContainText('ekleme engellendi')
})
