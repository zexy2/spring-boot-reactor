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
