import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'

test('typing in Java code editor does not re-render the entire App for every keystroke', async ({ page }) => {
  await page.addInitScript(() => {
    window.__editorRenderMetrics = { rootCommits: 0, appRenders: 0 }
    let previousAppHookState = null
    window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
      supportsFiber: true,
      inject() { return 1 },
      onCommitFiberRoot(_id, root) {
        window.__editorRenderMetrics.rootCommits += 1
        const queue = [root.current]
        while (queue.length) {
          const fiber = queue.pop()
          if (!fiber) continue
          if (fiber.type?.displayName === 'App' || fiber.type?.name === 'App') {
            // A function component gets a new hook-list head when it renders.
            // A child-only update keeps the previous hook-list reference.
            if (previousAppHookState && previousAppHookState !== fiber.memoizedState) {
              window.__editorRenderMetrics.appRenders += 1
            }
            previousAppHookState = fiber.memoizedState
          }
          if (fiber.sibling) queue.push(fiber.sibling)
          if (fiber.child) queue.push(fiber.child)
        }
      },
      onCommitFiberUnmount() {},
    }
  })

  await page.goto('?lesson=java-class')
  await page.locator('.learning-phase-nav button').nth(1).click()
  const editor = page.locator('.code-workout textarea')
  await expect(editor).toBeVisible()
  await editor.fill('class Product {}')
  const before = await page.evaluate(() => ({ ...window.__editorRenderMetrics }))
  await editor.pressSequentially('abcdefghijklmnopqrstuvwx', { delay: 20 })
  const after = await page.evaluate(() => ({ ...window.__editorRenderMetrics }))
  console.log('EDITOR_RENDER_METRICS', JSON.stringify({ before, after, appRendersPer24Keys: after.appRenders - before.appRenders }))
  await expect(editor).toHaveValue('class Product {}abcdefghijklmnopqrstuvwx')
  expect(after.rootCommits).toBeGreaterThan(before.rootCommits)
  expect(after.appRenders - before.appRenders).toBeLessThan(5)

  // The latest character must already be on disk before the deferred render.
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('spring-reactor-snapshot-v1')))
  expect(stored.learning['java-class'].codeDraft).toBe('class Product {}abcdefghijklmnopqrstuvwx')

  await page.waitForTimeout(450)
  const settled = await page.evaluate(() => ({ ...window.__editorRenderMetrics }))
  console.log('EDITOR_RENDER_SETTLED', JSON.stringify(settled))
  expect(settled.appRenders - after.appRenders).toBeGreaterThanOrEqual(1)
  expect(settled.appRenders - after.appRenders).toBeLessThanOrEqual(2)
  await expect(editor).toHaveValue('class Product {}abcdefghijklmnopqrstuvwx')
})

test('JSON export reads the latest Java draft even before the parent renders again', async ({ page }) => {
  await page.goto('?lesson=java-class')
  await page.locator('.learning-phase-nav button').nth(1).click()
  const editor = page.locator('.code-workout textarea')
  const draft = 'class Product { int immediateBackup; }'
  await editor.fill(draft)

  const mobileToggle = page.getByRole('button', { name: /Konu haritası/ })
  if (await mobileToggle.isVisible()) await mobileToggle.click()
  const backup = page.locator('.roadmap-intro .progress-backup')
  await backup.locator('summary').click()
  const downloadPromise = page.waitForEvent('download')
  await backup.getByRole('button', { name: 'JSON indir' }).click()
  const download = await downloadPromise
  const data = JSON.parse(await readFile(await download.path(), 'utf8'))
  expect(data.learning['java-class'].codeDraft).toBe(draft)
})
