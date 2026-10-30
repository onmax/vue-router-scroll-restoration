# Spec

Scroll restoration for Vue Router and Nuxt that works on any scroll container, not only `window`.

## Problem

Vue Router saves and restores only the window's scroll position ([vuejs/vue-router#1187](https://github.com/vuejs/vue-router/issues/1187), open since 2017). Dashboard layouts usually scroll an inner element, so `savedPosition` is always 0 and every app writes its own `beforeEach` + `ResizeObserver` code.

Prior art and why it falls short:

- [antfu/vue-router-better-scroller](https://github.com/antfu/vue-router-better-scroller): supports selectors, but v0.0.0 since June 2023. It saves a position only when you leave a page by link (`router.push`), never on Back, so Forward always lands at the top. It scrolls once after `nextTick`, before async Nuxt pages render, and never again when content grows.
- [nuxt-scroll-restoration](https://github.com/shimizukawa/nuxt-scroll-restoration): window only, Nuxt 3 only, monkey-patches `history.pushState`.
- Nuxt's default `scrollBehavior` (`nuxt/dist/pages/runtime/router.options.js`) gets the timing right (waits for `page:loading:end` and `nuxtApp['~transitionPromise']`, honours `meta.scrollToTop`), but only for `window`.

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

- One package with two entries: `.` is a framework-agnostic Vue Router plugin; `./nuxt` is a Nuxt module that wires it to Nuxt's timing. The Nuxt module registers its router options through Nuxt's `pages:routerOptions` hook instead of overwriting `router.options.scrollBehavior` at runtime.
- Options sketch (change it if the scenarios argue for something better):

  ```ts
  // nuxt.config.ts
  scrollRestoration: {
    containers: ['window', '[data-scroll-root]'],
    settleTimeout: 5000, // keep re-applying while content grows, at most this long
  }
  ```

  Per container, `true` or a handler `({ to, from, type: 'push' | 'history', savedPosition, element }) => position | false | true | Promise<…>`.
- No `pushState` patching. Small, no runtime dependencies besides `vue-router` (and `@nuxt/kit` for the module).

## Out of scope

Horizontal scrolling inside grids, virtualised lists that need an item index instead of a pixel offset, and smooth-scroll animation beyond passing `behavior` through.
