import type { RouteLocationNormalized, RouteLocationNormalizedLoaded, Router } from 'vue-router'
import { nextTick } from 'vue'
import { START_LOCATION } from 'vue-router'
import { abortOnInput, captureScroll, createScrollStore, findContainers, restoreScroll, WINDOW } from './core'

export type { ScrollPosition, ScrollSnapshot } from './core'

export type NavigationType = 'push' | 'replace' | 'traverse' | 'reload'

export interface ScrollRestorationOptions {
  /**
   * Selectors of the elements that scroll, `'window'` for the document. Elements with
   * `data-scroll-restoration-id` are tracked as well.
   * @default ['window']
   */
  containers?: string[]
  /**
   * Keep re-applying a restored position while content loads, for at most this many milliseconds.
   * User input or a new navigation stops it. `false` restores once.
   * @default 3000
   */
  settle?: number | false
  /**
   * Resolves when the new page is on screen. Restoring waits for it.
   * @default nextTick
   */
  ready?: (to: RouteLocationNormalized, from: RouteLocationNormalizedLoaded) => Promise<unknown>
}

declare module 'vue-router' {
  interface RouteMeta {
    /**
     * Shares one saved position between every visit to this route, links included, instead of
     * one per history entry. Read from the matched leaf route only, so child routes don't inherit it.
     */
    scrollKey?: string | ((to: RouteLocationNormalized) => string | undefined)
  }
}

/**
 * Saves the scroll position of every container when you leave a page and restores it when you
 * come back with Back, Forward or a reload. Other navigations start at the top, or at the hash.
 * Navigations that change only the query keep the position, and so do routes whose meta has
 * `scrollToTop: false` (or a function returning `false`), as in Nuxt.
 *
 * Replaces the router's `scrollBehavior`. Call it before or after the first navigation.
 * Does nothing on the server.
 */
export function setupScrollRestoration(router: Router, options: ScrollRestorationOptions = {}): void {
  if (typeof window === 'undefined')
    return

  const { containers = [WINDOW], settle, ready = () => nextTick() } = options
  const store = createScrollStore('vue-router-scroll-restoration')
  const routerHistory = router.options.history
  const entry = () => routerHistory.state.position as number

  router.options.scrollBehavior = undefined
  if (containers.includes(WINDOW))
    history.scrollRestoration = 'manual'

  // Prefixed keys keep snapshots readable across application updates.
  let currentKey: string | undefined
  let traversing = false
  let restoring: AbortController | undefined

  const capture = () => {
    if (currentKey !== undefined)
      store.set(currentKey, captureScroll(findContainers(containers)))
  }

  const navigated = (to: RouteLocationNormalized, from: RouteLocationNormalizedLoaded, traverse: boolean) => {
    const first = from === START_LOCATION
    // A fresh load after Back takes the index of the entry it pruned, whose snapshot isn't its own
    const reload = first && ['reload', 'back_forward'].includes((performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)?.type ?? '')
    const scrollKey = to.matched.at(-1)?.meta.scrollKey
    const shared = typeof scrollKey === 'function' ? scrollKey(to) : scrollKey
    currentKey = shared ? `key:${shared}` : `entry:${entry()}`

    if (samePlace(to, from))
      return
    const scrollToTop = to.meta.scrollToTop as boolean | ((to: RouteLocationNormalized, from: RouteLocationNormalized) => boolean) | undefined
    if ((typeof scrollToTop === 'function' ? scrollToTop(to, from) : scrollToTop) === false)
      return

    // a new entry has nothing saved; a replaced one holds the page it replaced
    const snapshot = currentKey.startsWith('key:') || traverse || reload ? store.get(currentKey) : undefined
    // the browser already shows a freshly loaded page at the top
    if (first && !snapshot && !to.hash)
      return

    const controller = restoring = new AbortController()
    // also while waiting for the page, which in Nuxt can take a while
    abortOnInput(controller)
    ready(to, from).then(() => {
      if (!controller.signal.aborted)
        restoreScroll(findContainers(containers), snapshot, to.hash, { signal: controller.signal, settle })
    })
  }

  routerHistory.listen((_to, _from, info) => traversing = info.type === 'pop')
  // the old page is still on screen
  router.beforeEach((to, from) => {
    capture()
    if (!samePlace(to, from))
      restoring?.abort()
  })
  router.afterEach((to, from, failure) => {
    const traverse = traversing
    traversing = false
    if (!failure)
      navigated(to, from, traverse)
  })
  if (router.currentRoute.value !== START_LOCATION)
    navigated(router.currentRoute.value, START_LOCATION, false)

  const persist = () => {
    capture()
    store.persist()
  }
  window.addEventListener('pagehide', persist)
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && persist())
}

/** Query-only changes, and the forced replace Nuxt makes after hydration, keep the position. */
function samePlace(to: RouteLocationNormalized, from: RouteLocationNormalized) {
  return from !== START_LOCATION && to.path === from.path && to.hash === from.hash
}
