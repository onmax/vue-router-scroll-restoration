# Spec

Scroll restoration for Vue Router and Nuxt that works on any scroll container, not only `window`.

## Problem

Vue Router saves and restores only the window's scroll position ([vuejs/vue-router#1187](https://github.com/vuejs/vue-router/issues/1187), open since 2017). Dashboard layouts usually scroll an inner element, so `savedPosition` is always 0 and every app writes its own `beforeEach` + `ResizeObserver` code.

Prior art and why it falls short:

- [antfu/vue-router-better-scroller](https://github.com/antfu/vue-router-better-scroller): supports selectors, but v0.0.0 since June 2023. It saves a position only when you leave a page by link (`router.push`), never on Back, so Forward always lands at the top. It scrolls once after `nextTick`, before async Nuxt pages render, and never again when content grows.
- [nuxt-scroll-restoration](https://github.com/shimizukawa/nuxt-scroll-restoration): window only, Nuxt 3 only, monkey-patches `history.pushState`.
- Nuxt's default `scrollBehavior` (`nuxt/dist/pages/runtime/router.options.js`) gets the timing right (waits for `page:loading:end` and `nuxtApp['~transitionPromise']`, honours `meta.scrollToTop`), but only for `window`.
- Vue Router 5.4.0 (2026-10-07) ships an experimental `ScrollRestoration` plugin with `useScrollRestoration()` and `onRouteRendered()` in `vue-router/experimental` ([docs](https://github.com/vuejs/router/blob/main/packages/docs/experimental/scroll-restoration.md), [source](https://github.com/vuejs/router/blob/main/packages/router/src/experimental/scroll-restoration.ts)). It handles several named positions and restores after Suspense and out-in transitions. Gaps for us: positions are keyed by `to.path + to.hash`, not by history entry, so a push to a page you visited before restores its old position; no re-apply while content grows; Nuxt doesn't use it yet.
- TanStack Router restores element scroll in router-core ([source](https://github.com/TanStack/router/blob/main/packages/router-core/src/scroll-restoration.ts)): capture-phase `scroll` listener, `data-scroll-restoration-id`, one key per history entry, `scrollToTopSelectors`, an inline script that restores before hydration. Tied to its own router, so we copy ideas, not code.

## Scope

Vue only: a Vue Router plugin and a Nuxt module, on top of a DOM core that imports no framework or router. React Router, SvelteKit, Solid and Angular each have their own key, navigation-type and "rendered" signals, so an adapter for them would carry all the timing logic; TanStack users are already covered. The core stays router-free so an adapter can be added later if someone needs it.

## The case that drives it

Quiver Portal (Nuxt 4.5, Vue Router 5.2, Nuxt UI 4 dashboard). The layout's `<div data-scroll-root class="overflow-y-auto">` scrolls, the window never does. Today Portal carries two hand-written workarounds, both of which this package should delete:

- A router plugin that records `scrollTop` per history entry, re-applies it with a `ResizeObserver` until user input, and installs itself after `app:mounted` because Nuxt applies its router options during startup (quiverdk/portal#1409).
- An `OverviewWithChild` component: the overview stays mounted but hidden while a child route shows, hiding it clamps the container's scroll, and the overview gets its height back a frame or two after it shows again, so it re-applies the saved position for up to 30 frames.

## Behaviour

Each numbered scenario below is one Playwright test in the playground. A scenario is done when its test passes in Chromium and WebKit.

1. **Push starts at the top.** Scroll the container, click a link to another page: the new page starts at `scrollTop` 0.
2. **Back restores.** Then press Back: the first page comes back at its old position.
3. **Forward restores.** Then press Forward: the second page comes back at the position it had when you left it with Back.
4. **Late content.** The page's table renders 300 ms and again 1500 ms after the route resolves. Back still lands on the saved position (it may jump, then settle).
5. **Async page.** A page that `await`s data in `setup` (Suspense) restores after it renders, not before.
6. **User input wins.** While a restore is still waiting for content, wheel, touch, pointer or key input cancels it; the page stays where the user put it.
7. **New navigation wins.** Navigating while a restore is pending cancels it.
8. **Query-only changes keep position.** Changing a filter in the query string (same path) leaves the scroll alone.
9. **Hash.** A link to `#section` scrolls that element into view inside the container, respecting `scroll-margin-top`.
10. **Several containers.** The window and one or more element containers are saved and restored independently, each by its own key.
11. **Container recreated by the route.** A container rendered inside the page (not the layout) is restored after the new page mounts it.
12. **Reload.** Reloading the page restores the container position (store it in `history.state`).
13. **Per-route control.** A route can opt out (`meta.scrollToTop: false`, as Nuxt does) or provide a function. This covers Portal's overview/child routes.
14. **Overview/child.** An overview page keeps a hidden overview mounted while a child route shows (as `OverviewWithChild` does). Opening a child starts at the top, Back or the in-page back link (a push to the overview path) returns to the overview's old position, without component code. If it needs an option, name it.
15. **Failed and redirected navigations** save nothing wrong and restore nothing.
16. **SSR.** No `window`/`document` access during server rendering, no hydration warnings.

## Shape

One npm package, three entries, so users install one thing and import what fits:

- `vue-router-scroll-restoration/core`: no framework imports, no-ops on the server.
  - Container registry: `[data-scroll-restoration-id]` elements and configured selectors, plus an opt-in capture-phase `scroll` listener that tracks any element that scrolls.
  - Store keyed by history entry: in memory, persisted to `sessionStorage` on `pagehide`, bounded, forward entries dropped on push. Never `replaceState` on `pagehide` (it evicts the page from Chrome's bfcache, nuxt/nuxt#36605).
  - `history.scrollRestoration`: `'manual'` while running, `'auto'` on `pagehide`, back to `'manual'` on a persisted `pageshow`.
  - Settle loop: re-apply the target with a `ResizeObserver` plus `requestAnimationFrame` until it holds, a timeout passes, the user scrolls or presses a key, or an `AbortSignal` from a newer navigation fires. Never pin to the bottom when the target can't be reached yet; wait for content instead. (Solid Router removed a loop like this for those reasons; the HTML spec allows retrying until the user scrolls.)
  - Hash scrolling inside a container with `scrollIntoView`, respecting `scroll-margin-top`.
  - Input contract per navigation: `{ type: 'push' | 'replace' | 'traverse' | 'reload', fromKey, toKey, hash, ready: Promise<void>, signal }`.
- `vue-router-scroll-restoration`: Vue Router plugin and composables. Entry key from Vue Router's `history.state.position`, navigation type from `router.options.history.listen` (`delta`), "ready" from `onRouteRendered` when available, otherwise `afterEach` plus `nextTick`. Composables: `useScrollContainer(ref, { id })`, `useScrollRestoration({ manual })` returning `{ scroll, savedPosition }` for virtual lists.
- `vue-router-scroll-restoration/nuxt`: Nuxt module. Registers router options through the `pages:routerOptions` hook instead of overwriting `scrollBehavior` at runtime. "Ready" is `page:loading:end`, then `nuxtApp['~transitionPromise']`, then one frame, skipped if a newer navigation started. Honours `definePageMeta({ scrollToTop })`. Auto-imports the composables. Optional inline head script that restores on reload before hydration.

Options sketch (change it if the scenarios argue for something better):

```ts
// nuxt.config.ts
scrollRestoration: {
  containers: ['window', '[data-scroll-root]'], // plus any [data-scroll-restoration-id]
  trackScrolledElements: false,                 // TanStack-style automatic tracking
  scrollToTopContainers: ['[data-scroll-root]'],// reset on push
  getKey: entry => entry.key,                   // share or split positions, e.g. by path
  settle: { timeout: 5000 },                    // false to restore once
}
```

Per container, `true` or a handler `({ to, from, type, savedPosition, element }) => position | false | true | Promise<…>`. Per navigation, `router.push({ ..., state: { scroll: false } })` keeps the position, like React Router's `preventScrollReset`.

No `pushState` patching. No runtime dependencies besides `vue-router` (and `@nuxt/kit` for the module).

## Lab order

1. **Spike: can `vue-router/experimental` cover the scenarios?** With Vue Router 5.4, custom `key`, `capture`, `restore` and `setupListeners`, run the scenario suite against it. Record which scenarios pass. If it passes most, build the Vue layer on top of it and keep only the gaps (per-entry keys, settle loop, Nuxt timing) in this package, and note what an upstream PR to vuejs/router would need. If not, write the Vue layer standalone with an API shaped like it, so it can move onto it later.
2. Core, Vue Router layer, Nuxt module, scenario by scenario.
3. A second playground without Nuxt (Vite + Vue Router) runs the same scenarios through the plain plugin.

## Out of scope

Horizontal scrolling inside grids, virtualised lists that need an item index instead of a pixel offset, and smooth-scroll animation beyond passing `behavior` through.
