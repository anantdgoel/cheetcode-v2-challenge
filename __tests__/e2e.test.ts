import { expect, test } from '@playwright/test'

test('landing page presents Firecrawl Exchange', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByText('incoming transmission')).toBeVisible()
  await expect(page.locator('.hero__headline')).toContainText('Firecrawl')
  await expect(page.locator('.hero__headline')).toContainText('Exchange')
  await expect(
    page.getByRole('button', { name: 'Sign in with GitHub' })
  ).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Prior Operators' })).toBeVisible()
  await expect(page.getByText('A game of connections')).toBeVisible()
})
