import { expect, test } from '@playwright/test'

test('fatal render errors show a recoverable application-level fallback', async ({ page }) => {
  await page.goto('?__e2e_crash=1')

  const alert = page.getByRole('alert')
  await expect(alert).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Bu ekran yüklenemedi.' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sayfayı yeniden yükle' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Ana ekrana dön' })).toBeVisible()

  await page.getByRole('button', { name: 'Ana ekrana dön' }).click()

  await expect(page).toHaveURL(/\/spring-boot-reactor\/$/)
  await expect(page.getByRole('button', { name: /JAVA BACKEND ÖĞRENME ATÖLYESİ/ })).toBeVisible()
})
