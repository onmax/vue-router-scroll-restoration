<script setup lang="ts">
import type { RouteLocationNormalized } from 'vue-router'
import { onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useScrollRestoration } from 'vue-router/experimental'

interface Position { left: number, top: number }
type Entry = Record<string, Position>
type ScrollToTop = boolean | ((to: RouteLocationNormalized, from: RouteLocationNormalized) => boolean)

// `plain` uses the API as documented. `workarounds` adds what it takes, with the
// same public API, to save one position per history entry, tell a link from
// Back/Forward and keep re-applying the position while content loads.
const workarounds = import.meta.env.MODE === 'workarounds'
const SETTLE = 3000

const router = useRouter()

function containers(): [string, Element | null][] {
  return [
    ['window', null],
    ['root', document.querySelector('[data-scroll-root]')],
    ...[...document.querySelectorAll<HTMLElement>('[data-scroll-restoration-id]')]
      .map((el): [string, Element] => [el.dataset.scrollRestorationId!, el]),
  ]
}

function read(el: Element | null): Position {
  return el ? { left: el.scrollLeft, top: el.scrollTop } : { left: window.scrollX, top: window.scrollY }
}

function sharedKey(route: RouteLocationNormalized) {
  return route.matched.at(-1)?.meta.scrollKey as string | undefined
}

// Workaround 1: key by history entry. `key(route)` only gets the route, and the
// plugin captures in `afterEach`, when `history.state` already belongs to the new
// entry, so each route object remembers the entry it was displayed in.
const entries = new WeakMap<RouteLocationNormalized, number>()
entries.set(router.currentRoute.value, history.state?.position)

// Workaround 2: tell a link from Back/Forward. `restore(entry, to)` gets neither
// `from` nor the navigation type.
// The first navigation is a traversal when the browser reloaded or went Back to the document
let pendingTraversal = ['reload', 'back_forward'].includes((performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)?.type ?? '')
let traversal = false
let from: RouteLocationNormalized = router.currentRoute.value
let lastTo: RouteLocationNormalized = router.currentRoute.value
const stopListening = router.options.history.listen(() => pendingTraversal = true)

// Workaround 4: input while the next page loads means the user already moved on,
// but `restore` runs once the page renders, whatever happened since.
let inputSinceNavigation = false
const inputs = ['wheel', 'touchstart', 'pointerdown', 'keydown']
const onInput = () => inputSinceNavigation = true
for (const type of inputs)
  window.addEventListener(type, onInput, { capture: true, passive: true })
const removeBeforeEach = router.beforeEach(() => {
  inputSinceNavigation = false
})
const removeAfterEach = router.afterEach((to, f, failure) => {
  if (failure)
    return
  entries.set(to, history.state?.position)
  traversal = pendingTraversal
  pendingTraversal = false
  from = f
  lastTo = to
})

useScrollRestoration({
  key: route => sharedKey(route) ?? (workarounds ? `entry:${entries.get(route) ?? history.state?.position}` : route.path + route.hash),
  capture: () => Object.fromEntries(containers().map(([id, el]) => [id, read(el)])),
  restore: (entry, to) => {
    stopSettling()
    const scrollToTop = to.meta.scrollToTop as ScrollToTop | undefined
    if ((typeof scrollToTop === 'function' ? scrollToTop(to, from) : scrollToTop) === false)
      return
    let saved = entry as Entry | undefined
    if (workarounds && inputSinceNavigation)
      return
    if (workarounds && to === lastTo && !traversal) {
      // A link or replace: same path and hash keep the position, otherwise start
      // fresh even if this history index held another page before Back pruned it
      if (from.path === to.path && from.hash === to.hash && from !== to)
        return
      if (!sharedKey(to))
        saved = undefined
    }
    if (!saved && to.hash) {
      document.getElementById(to.hash.slice(1))?.scrollIntoView()
      return
    }
    for (const [id, el] of containers())
      (el ?? window).scrollTo(saved?.[id] ?? { left: 0, top: 0 })
    if (workarounds && saved)
      settle(saved)
  },
})

// Workaround 3: content that loads after the page renders clamps the restored
// position, and nothing calls `scroll()` again. Re-apply until input or SETTLE ms.
let stopSettling = () => {}
function settle(saved: Entry) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SETTLE)
  const held = new Map(containers().map(([id, el]) => [id, read(el).top]))
  const anchoring = new Map<HTMLElement, string>()
  for (const [, el] of containers()) {
    // Content loading above the position would otherwise move it along
    if (el instanceof HTMLElement && !anchoring.has(el)) {
      anchoring.set(el, el.style.overflowAnchor)
      el.style.overflowAnchor = 'none'
    }
  }
  let frame = 0
  let shrunk = false
  const check = () => {
    frame = 0
    for (const [id, el] of containers()) {
      const target = saved[id]
      if (!target)
        continue
      const top = read(el).top
      const max = el ? el.scrollHeight - el.clientHeight : document.documentElement.scrollHeight - window.innerHeight
      // Moved since the last check, to a place it could have stayed, and not toward
      // the start after something shrank: the app or the browser scrolled it, so stop
      const moved = Math.abs(top - (held.get(id) ?? top)) > 1
      if (moved && top < max - 1 && !(shrunk && top < (held.get(id) ?? 0)))
        return controller.abort()
      if (Math.abs(top - target.top) > 1)
        (el ?? window).scrollTo(target)
      held.set(id, read(el).top)
    }
    shrunk = false
  }
  const observer = new MutationObserver((records) => {
    shrunk ||= records.some(record => record.type !== 'childList' || record.removedNodes.length > 0)
    frame ||= requestAnimationFrame(check)
  })
  observer.observe(document.querySelector('[data-scroll-root]') ?? document.body, { childList: true, subtree: true, attributes: true, characterData: true })
  for (const type of inputs)
    window.addEventListener(type, () => controller.abort(), { capture: true, passive: true, signal: controller.signal })
  window.addEventListener('scroll', () => frame ||= requestAnimationFrame(check), { capture: true, passive: true, signal: controller.signal })
  stopSettling = () => controller.abort()
  controller.signal.addEventListener('abort', () => {
    clearTimeout(timer)
    cancelAnimationFrame(frame)
    observer.disconnect()
    for (const [el, value] of anchoring)
      el.style.overflowAnchor = value
  })
}

onUnmounted(() => {
  stopSettling()
  stopListening()
  removeBeforeEach()
  removeAfterEach()
  for (const type of inputs)
    window.removeEventListener(type, onInput, { capture: true })
})
</script>

<template>
  <span hidden />
</template>
