import { expect, test } from '@playwright/test'

const root = '[data-scroll-root]'

test('push top, back and forward restore', async ({ page }) => {
  await page.goto('/long')
  await expect(page.getByTestId('title')).toHaveText('Long')
  await page.locator(root).evaluate(el => el.scrollTop = 1200)
  await page.getByTestId('nav-other').click()
  await expect(page.getByTestId('title')).toHaveText('Other')
  await expect.poll(() => page.locator(root).evaluate(el => el.scrollTop)).toBe(0)
  await page.locator(root).evaluate(el => el.scrollTop = 700)
  await page.goBack()
  await expect(page.getByTestId('title')).toHaveText('Long')
  await expect.poll(() => page.locator(root).evaluate(el => el.scrollTop)).toBe(1200)
  await page.goForward()
  await expect(page.getByTestId('title')).toHaveText('Other')
  await expect.poll(() => page.locator(root).evaluate(el => el.scrollTop)).toBe(700)
})
