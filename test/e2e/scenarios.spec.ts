import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

const root = '[data-scroll-root]'
const title = '[data-testid="title"]:visible'

interface ScrollSample {
  ms: number
  event: string
  path: string
  title: string | null
  top: number | undefined
  height: number | undefined
  inner: number | undefined
  window: number
  rows: string | null | undefined
}

declare global {
  interface Window {
    scenarioScrollTrace: ScrollSample[]
  }
}

async function expectTop(page: Page, expected: number, soft = false) {
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  await expect.configure({ soft }).poll(async () => Math.abs(await page.locator(root).evaluate(el => el.scrollTop) - expected), {
    message: `container should settle within 1 px of ${expected}`,
  }).toBeLessThanOrEqual(1)
}

async function scrollTo(page: Page, top: number) {
  await page.locator(root).evaluate((el, value) => el.scrollTop = value, top)
  await expectTop(page, top)
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
}

async function open(page: Page, path: string, text: string) {
  await page.goto(path)
  await expect(page.locator(title)).toHaveText(text)
}

async function navigate(page: Page, name: string, text: string) {
  await page.getByTestId(`nav-${name}`).click()
  await expect(page.locator(title)).toHaveText(text)
}

async function lateContentArrived(page: Page) {
  await expect(page.getByTestId('late-count')).toHaveText('120')
  await page.waitForTimeout(200)
}

async function beginLateRestore(page: Page) {
  await open(page, '/late', 'Late')
  await lateContentArrived(page)
  await scrollTo(page, 3500)
  await navigate(page, 'other', 'Other')
  await page.goBack()
  await expect(page.locator(title)).toHaveText('Late')
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.scenarioScrollTrace = []
    let last = ''
    function sample(event: string) {
      const scroller = document.querySelector('[data-scroll-root]')
      const heading = [...document.querySelectorAll('[data-testid="title"]')].find(el => el.getClientRects().length)
      const snapshot = {
        event,
        path: location.pathname + location.search + location.hash,
        title: heading?.textContent?.trim() ?? null,
        top: scroller?.scrollTop,
        height: scroller?.scrollHeight,
        inner: document.querySelector('[data-testid="inner"]')?.scrollTop,
        window: window.scrollY,
        rows: document.querySelector('[data-testid="late-count"]')?.textContent?.trim(),
      }
      const key = JSON.stringify(snapshot)
      if (key !== last) {
        window.scenarioScrollTrace.push({ ms: Math.round(performance.now()), ...snapshot })
        last = key
      }
    }
    for (const event of ['wheel', 'touchstart', 'pointerdown', 'keydown', 'popstate', 'pagehide', 'pageshow'])
      window.addEventListener(event, () => sample(event), { capture: true })
    function tick() {
      sample('frame')
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
})

// A failing test gets the scroll timeline of its page attached
test.afterEach(async ({ page }, info) => {
  if (info.status !== info.expectedStatus && !page.isClosed()) {
    await info.attach('scroll-timeline', {
      body: JSON.stringify(await page.evaluate(() => ({ trace: window.scenarioScrollTrace, history: history.state })), null, 2),
      contentType: 'application/json',
    })
  }
})

test('1. push starts at the top', async ({ page }) => {
  await open(page, '/long', 'Long')
  await scrollTo(page, 1200)
  await navigate(page, 'other', 'Other')
  await expectTop(page, 0)
})

test('2. back restores', async ({ page }) => {
  await open(page, '/long', 'Long')
  await scrollTo(page, 1200)
  await navigate(page, 'other', 'Other')
  await page.goBack()
  await expect(page.locator(title)).toHaveText('Long')
  await expectTop(page, 1200)
})

test('3. forward restores', async ({ page }) => {
  await open(page, '/long', 'Long')
  await scrollTo(page, 1200)
  await navigate(page, 'other', 'Other')
  await expectTop(page, 0)
  await scrollTo(page, 700)
  await page.goBack()
  await expect(page.locator(title)).toHaveText('Long')
  await expectTop(page, 1200)
  await page.goForward()
  await expect(page.locator(title)).toHaveText('Other')
  await expectTop(page, 700)
})

test('4. late content restores after both growth stages', async ({ page }) => {
  await beginLateRestore(page)
  await lateContentArrived(page)
  await expectTop(page, 3500)
})

test('5. async page restores after Suspense renders', async ({ page }) => {
  await open(page, '/async', 'Async')
  await scrollTo(page, 1700)
  await navigate(page, 'other', 'Other')
  await page.goBack()
  await expect(page.locator(title)).toHaveText('Async')
  await expectTop(page, 1700)
})

test('6. user input cancels a pending restore', async ({ page }) => {
  for (const input of ['wheel', 'touch', 'pointer', 'key']) {
    await test.step(input, async () => {
      await beginLateRestore(page)
      await expect(page.getByTestId('late-count')).toHaveText('40')
      if (input === 'wheel') {
        await page.locator(root).hover({ position: { x: 200, y: 200 } })
        await page.mouse.wheel(0, 200)
      }
      else if (input === 'touch') {
        await page.locator(root).dispatchEvent('touchstart', { touches: [{ identifier: 1, clientX: 200, clientY: 200 }] })
      }
      else if (input === 'pointer') {
        await page.locator(root).click({ position: { x: 200, y: 200 } })
      }
      else {
        await page.locator(root).evaluate((el) => {
          el.setAttribute('tabindex', '0')
          if (el instanceof HTMLElement)
            el.focus({ preventScroll: true })
        })
        await page.keyboard.press('ArrowDown')
      }
      await page.waitForTimeout(200)
      await scrollTo(page, 650)
      await lateContentArrived(page)
      await expect.configure({ soft: true }).poll(async () => Math.abs(await page.locator(root).evaluate(el => el.scrollTop) - 650), {
        message: `${input} must keep the user's 650 px position after all late rows arrive`,
      }).toBeLessThanOrEqual(1)
    })
  }
})

test('6. user input while the page is still loading cancels its restore', async ({ page }) => {
  await open(page, '/async', 'Async')
  await scrollTo(page, 2000)
  await navigate(page, 'other', 'Other')
  await page.goBack()
  // Async waits 400 ms in setup, so this lands before it renders. A press, not a wheel,
  // because Chromium animates wheel scrolling past the position the test sets
  await page.locator(root).click({ position: { x: 200, y: 200 } })
  await page.locator(root).evaluate(el => el.scrollTop = 300)
  await expect(page.locator(title)).toHaveText('Async')
  await page.waitForTimeout(500)
  await expectTop(page, 300)
})

test('7. a new navigation cancels a pending restore', async ({ page }) => {
  await beginLateRestore(page)
  await expect(page.getByTestId('late-count')).toHaveText('40')
  await page.getByTestId('nav-long').evaluate((el) => {
    if (el instanceof HTMLElement)
      el.click()
  })
  await expect(page.locator(title)).toHaveText('Long')
  await expectTop(page, 0)
  await scrollTo(page, 800)
  await page.waitForTimeout(1700)
  await expect(page.locator(title)).toHaveText('Long')
  await expectTop(page, 800)
})

test('8. query-only filter changes keep position', async ({ page }) => {
  await open(page, '/filters?status=a', 'Filters: a')
  await page.getByTestId('filter-b').scrollIntoViewIfNeeded()
  const saved = await page.locator(root).evaluate(el => el.scrollTop)
  await page.getByTestId('filter-b').click()
  await expect(page.locator(title)).toHaveText('Filters: b')
  await expect(page).toHaveURL(/\/filters\?status=b$/)
  await expectTop(page, saved)
  await page.getByTestId('filter-a').click()
  await expect(page.locator(title)).toHaveText('Filters: a')
  await expectTop(page, saved)
})

test('8. the entry a query change leaves keeps its own position', async ({ page }) => {
  await open(page, '/filters?status=a', 'Filters: a')
  await page.getByTestId('filter-b').scrollIntoViewIfNeeded()
  const saved = await page.locator(root).evaluate(el => el.scrollTop)
  await page.getByTestId('filter-b').click()
  await expect(page.locator(title)).toHaveText('Filters: b')
  await navigate(page, 'other', 'Other')
  await page.evaluate(() => history.go(-2))
  await expect(page.locator(title)).toHaveText('Filters: a')
  await expectTop(page, saved)
})

test('9. hash scrolling respects the container and scroll-margin-top', async ({ page }) => {
  await open(page, '/long', 'Long')
  await scrollTo(page, 900)
  await navigate(page, 'hash', 'Hash')
  await expect.poll(() => page.getByTestId('section-5').evaluate((el) => {
    const container = document.querySelector('[data-scroll-root]')
    if (!container)
      throw new Error('Fixture scroll root is missing')
    const inset = el.getBoundingClientRect().top - container.getBoundingClientRect().top - container.clientTop
    return Math.abs(inset - Number.parseFloat(getComputedStyle(el).scrollMarginTop))
  })).toBeLessThanOrEqual(1)
  await expect.poll(() => page.evaluate(() => Math.abs(window.scrollY))).toBeLessThanOrEqual(1)
})

test('10. window and element containers restore independently', async ({ page }) => {
  await open(page, '/inner', 'Inner')
  await page.addStyleTag({ content: 'html, body { height: auto; min-height: 2100px; } .layout { position: fixed; inset: 0; }' })
  await scrollTo(page, 400)
  await page.getByTestId('inner').evaluate(el => el.scrollTop = 700)
  await page.evaluate(() => window.scrollTo(0, 300))
  await expect.poll(() => page.evaluate(() => Math.abs(window.scrollY - 300))).toBeLessThanOrEqual(1)
  await expect.poll(() => page.getByTestId('inner').evaluate(el => Math.abs(el.scrollTop - 700))).toBeLessThanOrEqual(1)
  await navigate(page, 'other', 'Other')
  await expectTop(page, 0)
  await expect.poll(() => page.evaluate(() => Math.abs(window.scrollY))).toBeLessThanOrEqual(1)
  await scrollTo(page, 600)
  await page.evaluate(() => window.scrollTo(0, 150))
  await page.goBack()
  await expect(page.locator(title)).toHaveText('Inner')
  await expectTop(page, 400)
  await expect.poll(() => page.getByTestId('inner').evaluate(el => Math.abs(el.scrollTop - 700))).toBeLessThanOrEqual(1)
  await expect.poll(() => page.evaluate(() => Math.abs(window.scrollY - 300))).toBeLessThanOrEqual(1)
})

test('11. a route-created container restores after remount', async ({ page }) => {
  await open(page, '/inner', 'Inner')
  await page.getByTestId('inner').evaluate((el) => {
    el.scrollTop = 1350
    el.setAttribute('data-original-container', 'true')
  })
  await expect.poll(() => page.getByTestId('inner').evaluate(el => Math.abs(el.scrollTop - 1350))).toBeLessThanOrEqual(1)
  await navigate(page, 'other', 'Other')
  await expect(page.getByTestId('inner')).toHaveCount(0)
  await page.goBack()
  await expect(page.locator(title)).toHaveText('Inner')
  await expect(page.getByTestId('inner')).not.toHaveAttribute('data-original-container', 'true')
  await expect.poll(() => page.getByTestId('inner').evaluate(el => Math.abs(el.scrollTop - 1350))).toBeLessThanOrEqual(1)
})

test('12. reload restores the history entry position', async ({ page }) => {
  await open(page, '/long', 'Long')
  await scrollTo(page, 1800)
  await page.reload()
  await expect(page.locator(title)).toHaveText('Long')
  await expectTop(page, 1800)
})

test('13. per-route false and function policies keep position', async ({ page }) => {
  await open(page, '/long', 'Long')
  await scrollTo(page, 1200)
  await navigate(page, 'keep', 'Keep')
  await expectTop(page, 1200)
  await scrollTo(page, 800)
  await navigate(page, 'keep-function', 'Keep')
  await expect(page).toHaveURL(/\/keep-function$/)
  await expectTop(page, 800)
})

test('14. hidden overview restores on Back and the in-page push link', async ({ page }) => {
  await open(page, '/items', 'Items')
  await scrollTo(page, 1200)
  await page.getByTestId('overview').evaluate(el => el.setAttribute('data-original-overview', 'true'))
  await page.getByTestId('overview').getByTestId('row-28').getByRole('link').click()
  await expect(page.locator(title)).toHaveText('Item 28')
  await expect(page.getByTestId('overview')).toBeHidden()
  await expectTop(page, 0, true)
  await page.goBack()
  await expect(page.locator(title)).toHaveText('Items')
  await expectTop(page, 1200, true)
  await expect(page.getByTestId('overview')).toHaveAttribute('data-original-overview', 'true')
  await page.getByTestId('overview').getByTestId('row-28').getByRole('link').click()
  await expect(page.locator(title)).toHaveText('Item 28')
  await expectTop(page, 0, true)
  await page.getByTestId('back-to-overview').click()
  await expect(page.locator(title)).toHaveText('Items')
  await expectTop(page, 1200, true)
  await expect(page.getByTestId('overview')).toHaveAttribute('data-original-overview', 'true')
})

test('15. blocked and redirected navigations preserve the right entries', async ({ page }) => {
  await open(page, '/long', 'Long')
  await scrollTo(page, 1200)
  await page.getByTestId('nav-blocked').click()
  await page.waitForTimeout(200)
  await expect(page).toHaveURL(/\/long$/)
  await expect(page.locator(title)).toHaveText('Long')
  await expectTop(page, 1200)
  await scrollTo(page, 1400)
  await navigate(page, 'redirect', 'Other')
  await expect(page).toHaveURL(/\/other$/)
  await expectTop(page, 0)
  await scrollTo(page, 700)
  await page.goBack()
  await expect(page.locator(title)).toHaveText('Long')
  await expectTop(page, 1400)
  await page.goForward()
  await expect(page.locator(title)).toHaveText('Other')
  await expectTop(page, 700)
})

test('16. SSR renders HTML and navigates without hydration warnings', async ({ page, request }, info) => {
  test.skip(info.project.name.startsWith('vue-'), 'The Vite playground is client-rendered; SSR is a Nuxt-only scenario.')
  const problems: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error' || /hydrat/i.test(message.text()))
      problems.push(`console ${message.type()}: ${message.text()}`)
  })
  page.on('pageerror', error => problems.push(`pageerror: ${error.message}`))
  for (const { path, heading } of [
    { path: '/long', heading: 'Long' },
    { path: '/async', heading: 'Async' },
    { path: '/inner', heading: 'Inner' },
    { path: '/items', heading: 'Items' },
  ]) {
    const response = await request.get(path)
    expect(response.status()).toBe(200)
    const html = await response.text()
    expect(html).toMatch(/<div[^>]*data-scroll-root/)
    expect(html).toMatch(new RegExp(`<h1[^>]*data-testid="title"[^>]*>\\s*${heading}\\s*</h1>`))
    expect(html).toContain('data-testid="row-20"')
    await open(page, path, heading)
    await navigate(page, 'other', 'Other')
    await page.goBack()
    await expect(page.locator(title)).toHaveText(heading)
  }
  await page.waitForTimeout(200)
  expect(problems).toEqual([])
})
