import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const wcagTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']
const blockingImpacts = new Set(['serious', 'critical'])

function blockingViolations(result) {
  return result.violations.filter((violation) => blockingImpacts.has(violation.impact))
}

function violationSummary(violations) {
  return violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    help: violation.help,
    targets: violation.nodes.slice(0, 5).map((node) => node.target),
  }))
}

async function expectNoBlockingAccessibilityViolations(page) {
  const result = await new AxeBuilder({ page }).withTags(wcagTags).analyze()
  const violations = blockingViolations(result)
  expect(violations, JSON.stringify(violationSummary(violations), null, 2)).toEqual([])
}

test('learning roadmap has no serious or critical WCAG A/AA violations', async ({ page }) => {
  await page.goto('')
  await expect(page.getByRole('heading', { name: 'Bugün ne çalışacağını düşünme.' })).toBeVisible()
  await expectNoBlockingAccessibilityViolations(page)
})

test('interactive process lesson has no serious or critical WCAG A/AA violations', async ({ page }) => {
  await page.goto('?lesson=requirement-discovery')
  await page.locator('.learning-phase-nav button').nth(1).click()
  await expect(page.locator('.process-game')).toBeVisible()
  await expectNoBlockingAccessibilityViolations(page)
})
