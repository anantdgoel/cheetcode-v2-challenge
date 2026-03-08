import { expect, test } from '@playwright/test'

test('landing page presents Firecrawl Exchange', async ({ page }) => {
  await page.goto('/')

  await expect(
    page.getByRole('heading', { name: 'Firecrawl Exchange' })
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Sign In With GitHub' })
  ).toBeVisible()
  await expect(page.getByText('1963 Switchboard Challenge')).toBeVisible()
})
