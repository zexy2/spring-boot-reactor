import { expect, test } from '@playwright/test'

test('real-world scenario timer expires after elapsed time even when interval callbacks are throttled', async ({ page }) => {
  await page.clock.install()
  await page.goto('./')

  await page.locator('.role-interview-launcher').getByRole('button', { name: /6 soruluk/ }).click()
  const interview = page.locator('.role-interview-card')
  await expect(interview.locator('.interview-timer')).toHaveText('90s')

  // fastForward skips intermediate timer callbacks, as background tab throttling can.
  await page.clock.fastForward(91_000)
  await expect(interview.locator('.interview-timer')).toHaveText('0s')
  await expect(interview.getByText('GÜÇLÜ CEVAPTA OLMASI GEREKENLER')).toBeVisible()

  await interview.getByRole('button', { name: 'Puanı kaydet · sonraki soru' }).click()
  await expect(interview.locator('.interview-timer')).toHaveText('90s')
  await page.clock.fastForward(35_000)
  await expect(interview.locator('.interview-timer')).toHaveText('55s')
})

test('mixed-interview timer uses elapsed time after a suspended tab resumes', async ({ page }) => {
  await page.clock.install()
  await page.goto('./')

  await page.locator('.mixed-interview-launcher').getByRole('button', { name: /5 soruluk turu/ }).click()
  const interview = page.locator('.mixed-interview-card')
  await expect(interview.locator('.interview-timer')).toHaveText('60s')

  await page.clock.fastForward(65_000)
  await expect(interview.locator('.interview-timer')).toHaveText('0s')
  await expect(interview.getByText('REFERANS CEVAP')).toBeVisible()
})
