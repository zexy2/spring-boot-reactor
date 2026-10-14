import { expect, test } from '@playwright/test'

test('readiness panel exposes scores and restores keyboard focus on Escape and close', async ({ page }) => {
  await page.goto('./')
  const trigger = page.getByRole('button', { name: /MÜLAKAT/ })
  const dialog = page.getByRole('dialog', { name: 'MÜLAKAT HAZIRLIK' })

  await trigger.click()
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Hazırlık detayını kapat' })).toBeFocused()
  await expect(dialog.getByRole('progressbar')).toHaveCount(6)
  await expect(dialog.getByRole('progressbar', { name: 'Müfredat düzeyi' })).toHaveAttribute('aria-valuenow', /^\d+$/)

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(trigger).toBeFocused()
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')

  await trigger.click()
  await dialog.getByRole('button', { name: 'Hazırlık detayını kapat' }).click()
  await expect(dialog).toBeHidden()
  await expect(trigger).toBeFocused()
})

test('outside pointer dismissal preserves the clicked control and trigger can toggle the panel', async ({ page }) => {
  await page.goto('./')
  const trigger = page.getByRole('button', { name: /MÜLAKAT/ })
  const dialog = page.getByRole('dialog', { name: 'MÜLAKAT HAZIRLIK' })

  await trigger.click()
  await expect(dialog).toBeVisible()
  await trigger.click()
  await expect(dialog).toBeHidden()
  await expect(trigger).toBeFocused()

  await trigger.click()
  const focusMode = page.getByRole('button', { name: 'Odak modu' })
  await focusMode.click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('button', { name: 'Haritayı aç' })).toBeFocused()
  await expect(page.locator('main')).toHaveClass(/focus-mode/)
})
