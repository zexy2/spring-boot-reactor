import { expect, test } from '@playwright/test'

test('mobile roadmap hides its links and restores focus when dismissed with Escape', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'Mobile roadmap disclosure')

  await page.goto('./')
  const toggle = page.getByRole('button', { name: /Konu haritası/ })
  const navigation = page.locator('#roadmap-navigation')
  const search = navigation.getByRole('searchbox', { name: 'Konu ara' })

  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(navigation).toBeHidden()

  await toggle.focus()
  await page.keyboard.press('Tab')
  expect(await navigation.evaluate((element) => element.contains(document.activeElement))).toBe(false)

  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(navigation).toBeVisible()

  await toggle.focus()
  await page.keyboard.press('Tab')
  await expect(search).toBeFocused()

  await page.keyboard.press('Tab')
  await expect(navigation.getByRole('button', { name: 'Tümü' })).toBeFocused()
  await page.keyboard.press('Escape')

  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(navigation).toBeHidden()
  await expect(toggle).toBeFocused()
})

test('selecting the already-active lesson from mobile roadmap focuses learning content', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'Mobile roadmap disclosure')

  await page.goto('./')
  const toggle = page.getByRole('button', { name: /Konu haritası/ })
  await toggle.click()
  const activeLink = page.locator('#roadmap-navigation .lesson-link.active')
  await activeLink.focus()
  await activeLink.press('Enter')

  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(page.locator('#roadmap-navigation')).toBeHidden()
  await expect(page.locator('#learning-area')).toBeFocused()
})
