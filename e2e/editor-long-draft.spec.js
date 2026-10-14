import { expect, test } from '@playwright/test'

const SNAPSHOT_KEY = 'spring-reactor-snapshot-v1'

function javaDraft(length) {
  const line = '  int value = 42; // editor latency sample\n'
  const body = line.repeat(Math.ceil(length / line.length)).slice(0, length - 20)
  return `class Benchmark {\n${body}\n}`
}

test('long Java drafts accept input and synchronously preserve last keystroke', async ({ page }) => {
  await page.goto('?lesson=java-class')
  await page.locator('.learning-phase-nav button').nth(1).click()
  const editor = page.locator('.code-workout textarea')
  await expect(editor).toBeVisible()

  for (const length of [5000, 19000]) {
    const draft = javaDraft(length)
    await editor.fill(draft)
    await expect(editor).toHaveValue(draft)

    const metrics = await page.evaluate(({ key, count }) => {
      const target = document.querySelector('.code-workout textarea')
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set
      const durations = []
      let next = target.value
      for (let i = 0; i < count; i += 1) {
        next += String.fromCharCode(97 + i)
        setter.call(target, next)
        const start = performance.now()
        target.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: next.at(-1) }))
        durations.push(performance.now() - start)
        const stored = JSON.parse(localStorage.getItem(key))
        if (stored.learning['java-class'].codeDraft !== next) throw new Error(`Key ${i} not persisted immediately`)
      }
      const samples = [...durations].sort((a, b) => a - b)
      return { length: next.length, lines: next.split('\n').length, samples, median: samples[Math.floor(samples.length / 2)], p95: samples[Math.floor(samples.length * .95)] }
    }, { key: SNAPSHOT_KEY, count: 12 })

    console.log('EDITOR_LONG_DRAFT_METRICS', JSON.stringify(metrics))
    await expect(editor).toHaveValue(`${draft}abcdefghijkl`)
    await page.reload()
    await page.locator('.learning-phase-nav button').nth(1).click()
    await expect(editor).toHaveValue(`${draft}abcdefghijkl`)
  }
})

test('high line-count paste keeps code editor and line numbers responsive', async ({ page }) => {
  await page.goto('?lesson=java-class')
  await page.locator('.learning-phase-nav button').nth(1).click()
  const editor = page.locator('.code-workout textarea')
  const lineCount = process.env.EDITOR_STRESS === '1' ? 16000 : 2000
  const draft = `class A {\n${'\n'.repeat(lineCount)}}`
  const start = Date.now()
  await editor.fill(draft)
  const fillMs = Date.now() - start
  await expect(editor).toHaveValue(draft)
  const gutter = page.locator('.code-editor-gutter')
  const gutterCount = await gutter.locator('span').count()
  console.log('EDITOR_HIGH_LINE_COUNT_METRICS', JSON.stringify({ characters: draft.length, lines: lineCount + 2, gutterCount, fillMs }))
  expect(gutterCount).toBeLessThanOrEqual(200)
  await expect(gutter).toContainText(String(lineCount + 2))
  const scroll = await editor.evaluate((element) => {
    element.scrollTop = element.scrollHeight / 2
    element.dispatchEvent(new Event('scroll', { bubbles: true }))
    const gutterElement = document.querySelector('.code-editor-gutter')
    const shell = document.querySelector('.code-editor-shell')
    return {
      editorScrollTop: element.scrollTop,
      gutterScrollTop: gutterElement.scrollTop,
      editorHeight: element.clientHeight,
      editorContentHeight: element.scrollHeight,
      gutterHeight: gutterElement.clientHeight,
      gutterContentHeight: gutterElement.scrollHeight,
      shellHeight: shell.clientHeight,
    }
  })
  console.log('EDITOR_DENSE_SCROLL_METRICS', JSON.stringify(scroll))
  expect(scroll.editorScrollTop).toBeGreaterThan(0)
  expect(scroll.gutterScrollTop).toBeGreaterThan(0)
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).learning['java-class'].codeDraft, SNAPSHOT_KEY)
  expect(saved).toBe(draft)
  await editor.press('End')
  await editor.pressSequentially('final', { delay: 10 })
  await expect(editor).toHaveValue(`${draft}final`)
})
