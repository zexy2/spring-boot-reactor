import { expect, test } from '@playwright/test'

async function openRequestFlow(page) {
  await page.goto('?lesson=request-flow')
  await page.locator('.learning-phase-nav button').nth(1).click()
  const lab = page.locator('.request-lab')
  await expect(lab).toBeVisible()
  return {
    lab,
    playback: lab.getByRole('button', { name: 'Otomatik oynatma' }),
    current: lab.locator('.flow-node[aria-current="step"]'),
  }
}

test('reduced motion pauses request playback until learner explicitly enables it', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const { lab, playback, current } = await openRequestFlow(page)

  await expect(playback).toHaveAttribute('aria-pressed', 'false')
  await expect(lab.locator('.lab-readout')).toHaveAttribute('aria-live', 'polite')
  await expect(current).toContainText('Browser')
  await page.waitForTimeout(2450)
  await expect(current).toContainText('Browser')

  await lab.getByRole('button', { name: /Sonraki/ }).click()
  await expect(current).toContainText('DispatcherServlet')
  await page.waitForTimeout(2450)
  await expect(current).toContainText('DispatcherServlet')

  await playback.click()
  await expect(playback).toHaveAttribute('aria-pressed', 'true')
  await expect(lab.locator('.lab-readout')).toHaveAttribute('aria-live', 'off')
  await expect(current).toContainText('Controller', { timeout: 5000 })
})

test('normal-motion playback can be stopped and stays stopped after choosing a node', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  const { lab, playback, current } = await openRequestFlow(page)

  await expect(playback).toHaveAttribute('aria-pressed', 'true')
  await expect(current).toContainText('DispatcherServlet', { timeout: 5000 })
  await lab.locator('.flow-node').nth(3).click()
  await expect(playback).toHaveAttribute('aria-pressed', 'false')
  await expect(current).toContainText('Service')
  await page.waitForTimeout(2450)
  await expect(current).toContainText('Service')
})

test('narrow mobile request flow keeps the active stage visible while stepping', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'Dedicated mobile regression')
  await page.emulateMedia({ reducedMotion: 'reduce' })

  for (const width of [320, 400]) {
    await page.setViewportSize({ width, height: 780 })
    const { lab, current } = await openRequestFlow(page)
    const activeFits = () => lab.locator('.flow-track').evaluate((track) => {
      const active = track.querySelector('[aria-current="step"]')
      const viewport = track.getBoundingClientRect()
      const node = active.getBoundingClientRect()
      return node.left >= viewport.left - 1 && node.right <= viewport.right + 1
    })

    await lab.getByRole('button', { name: /Önceki/ }).click()
    await expect(current).toContainText('Database')
    await expect.poll(activeFits).toBe(true)

    await lab.getByRole('button', { name: /Sonraki/ }).click()
    await expect(current).toContainText('Browser')
    await expect.poll(activeFits).toBe(true)

    for (let step = 0; step < 4; step += 1) {
      await lab.getByRole('button', { name: /Sonraki/ }).click()
    }
    await expect.poll(activeFits).toBe(true)
  }
})

test('mobile autoplay follows the currently highlighted request stage', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'Dedicated mobile regression')
  await page.setViewportSize({ width: 320, height: 780 })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  const { lab, current } = await openRequestFlow(page)

  await expect(current).toContainText('Service', { timeout: 10000 })
  await expect.poll(() => lab.locator('.flow-track').evaluate((track) => {
    const active = track.querySelector('[aria-current="step"]')?.getBoundingClientRect()
    const viewport = track.getBoundingClientRect()
    return Boolean(active && active.left >= viewport.left - 1 && active.right <= viewport.right + 1)
  })).toBe(true)
})
