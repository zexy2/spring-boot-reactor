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

test('visible partial DOM selection wins over a stale nonempty CodeMirror selection', async ({ page }) => {
  const editor = await openEditor(page)
  await editor.fill('class Demo {}')
  await expectCode(editor, 'class Demo {}')
  const details = await editor.evaluate((content) => {
    const view = content.closest('.cm-editor')
    // Old editor selection points at "Demo"; the browser has just selected "class".
    view.__selectCodeRange(6, 10)
    const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT)
    let node
    while ((node = walker.nextNode()) && !node.textContent.includes('class')) {}
    if (!node) throw new Error('Expected rendered class token')
    const from = node.textContent.indexOf('class')
    const range = document.createRange()
    range.setStart(node, from)
    range.setEnd(node, from + 5)
    const domSelection = window.getSelection()
    domSelection.removeAllRanges()
    domSelection.addRange(range)
    const domText = range.toString()
    const event = new InputEvent('beforeinput', {
      bubbles: true, cancelable: true, inputType: 'insertText', data: 'public',
    })
    content.dispatchEvent(event)
    return { prevented: event.defaultPrevented, domText }
  })
  expect(details).toEqual({ prevented: true, domText: 'class' })
  await expectCode(editor, 'public Demo {}')
  await editor.press('ControlOrMeta+z')
  await expectCode(editor, 'class Demo {}')
})

test('composition input remains owned by CodeMirror even if insertText reports not composing', async ({ page }) => {
  const editor = await openEditor(page)
  const details = await editor.evaluate((content) => {
    content.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '' }))
    const input = new InputEvent('beforeinput', {
      bubbles: true, cancelable: true, inputType: 'insertText', data: '日本語', isComposing: false,
    })
    content.dispatchEvent(input)
    content.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '日本語' }))
    const afterComposition = new InputEvent('beforeinput', {
      bubbles: true, cancelable: true, inputType: 'insertText', data: 'class',
    })
    content.dispatchEvent(afterComposition)
    return { prevented: input.defaultPrevented, afterCompositionPrevented: afterComposition.defaultPrevented }
  })
  expect(details).toEqual({ prevented: false, afterCompositionPrevented: true })
})

test('Ctrl+Enter does not verify a lesson during IME composition', async ({ page }) => {
  const editor = await openEditor(page)
  await editor.fill('class Demo {}')
  const details = await editor.evaluate((content) => {
    content.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '' }))
    const shortcut = new KeyboardEvent('keydown', {
      bubbles: true, cancelable: true, key: 'Enter', ctrlKey: true, isComposing: false,
    })
    content.dispatchEvent(shortcut)
    content.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '' }))
    const lateEvent = new KeyboardEvent('keydown', {
      bubbles: true, cancelable: true, key: 'Enter', ctrlKey: true, isComposing: true,
    })
    content.dispatchEvent(lateEvent)
    return { prevented: shortcut.defaultPrevented, latePrevented: lateEvent.defaultPrevented }
  })
  expect(details).toEqual({ prevented: false, latePrevented: false })
  await expect(page.locator('.code-workout-feedback')).toHaveCount(0)
  await editor.press('ControlOrMeta+Enter')
  await expect(page.locator('.code-workout-feedback')).toBeVisible()
})

test('native clipboard paste preserves a selected multiline draft, undo and saved progress', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  const editor = await openEditor(page)
  const initial = 'class Demo { int old = 1; }'
  const replacement = 'class Demo {\n  String message = "Merhaba";\n  int count = 2;\n}'
  await editor.fill(initial)
  await editor.focus()
  await editor.press('ControlOrMeta+a')
  await page.evaluate((text) => navigator.clipboard.writeText(text), replacement)
  await editor.press('ControlOrMeta+v')
  await expectCode(editor, replacement)
  await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key))?.learning?.['java-class']?.codeDraft, SNAPSHOT_KEY)).toBe(replacement)
  await editor.press('ControlOrMeta+z')
  await expectCode(editor, initial)
  await editor.press('ControlOrMeta+Shift+z')
  await expectCode(editor, replacement)
  await page.reload()
  await page.locator('.learning-phase-nav button').nth(1).click()
  await expectCode(editor, replacement)
})

test('select-all and multiline replacement include offscreen code on mobile and desktop', async ({ page }) => {
  const editor = await openEditor(page)
  const initial = `class LongDraft {\n${'  int oldValue;\n'.repeat(1000)}}`
  const replacement = 'class Replaced {\n  int value;\n}'
  await editor.fill(initial)
  await expectCode(editor, initial)
  await editor.focus()
  await editor.press('ControlOrMeta+a')
  expect(await editor.evaluate((node) => node.closest('.cm-editor').__codeSelection()))
    .toEqual([0, initial.length])
  await page.keyboard.insertText(replacement)
  await expectCode(editor, replacement)
  await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key))?.learning?.['java-class']?.codeDraft, SNAPSHOT_KEY)).toBe(replacement)
  await editor.press('ControlOrMeta+z')
  await expectCode(editor, initial)
  await editor.press('ControlOrMeta+Shift+z')
  await expectCode(editor, replacement)
})

test('native clipboard paste respects the draft length limit without changing saved text', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  const editor = await openEditor(page)
  const currentDraft = 'x'.repeat(19999)
  await editor.fill(currentDraft)
  await editor.press('End')
  await page.evaluate(() => navigator.clipboard.writeText('oversized'))
  await editor.press('ControlOrMeta+v')
  await expectCode(editor, currentDraft)
  await expect(page.locator('.code-editor-limit-alert')).toContainText('20.000 karakter sınırı')
  await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key))?.learning?.['java-class']?.codeDraft, SNAPSHOT_KEY)).toBe(currentDraft)
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
