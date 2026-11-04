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

A Nuxt 4 dashboard built with Nuxt UI. The layout's `<div data-scroll-root class="overflow-y-auto">` scrolls, the window never does. Apps like it carry two hand-written workarounds, both of which this package should replace:

- A router plugin that records `scrollTop` per history entry, re-applies it with a `ResizeObserver` until user input, and installs itself after `app:mounted` because Nuxt applies its router options during startup.
- An overview component that stays mounted but hidden while a child route shows. Hiding it clamps the container's scroll, and the overview gets its height back a frame or two after it shows again, so it re-applies the saved position for up to 30 frames.

## Behaviour

Each numbered scenario below is one Playwright test in the playground. A scenario is done when its test passes in Chromium and WebKit.

1. **Push starts at the top.** Scroll the container, click a link to another page: the new page starts at `scrollTop` 0.
2. **Back restores.** Then press Back: the first page comes back at its old position.
3. **Forward restores.** Then press Forward: the second page comes back at the position it had when you left it with Back.
4. **Late content.** The page's table renders 300 ms and again 1500 ms after the route resolves. Back still lands on the saved position (it may jump, then settle).
5. **Async page.** A page that `await`s data in `setup` (Suspense) restores after it renders, not before.
6. **User input wins.** While a restore is still waiting for content, wheel, touch, pointer or key input cancels it; the page stays where the user put it. An app scroll to an unclamped position also wins, including when content grows in the same frame.
7. **New navigation wins.** Navigating while a restore is pending cancels it.
8. **Query-only changes keep position.** Changing a filter in the query string (same path) leaves the scroll alone.
9. **Hash.** A link to `#section` scrolls that element into view inside the container, respecting `scroll-margin-top`.
10. **Several containers.** The window and one or more element containers are saved and restored independently, each by its own key.
11. **Container recreated by the route.** A container rendered inside the page (not the layout) is restored after the new page mounts it.
12. **Reload.** Reloading the page restores the container position (kept in `sessionStorage`, written on `pagehide`, never with `replaceState`). A fresh load (a typed URL, a plain link) starts at the top, even when it takes the history index of an entry that Back pruned, so the browser's navigation type decides, not the index.
13. **Per-route control.** A route can opt out (`meta.scrollToTop: false`, as Nuxt does) or provide a function. This covers overview/child routes.
14. **Overview/child.** An overview page keeps a hidden overview mounted while a child route shows (as such an overview component does). Opening a child starts at the top, Back or the in-page back link (a push to the overview path) returns to the overview's old position, without component code. If it needs an option, name it.
15. **Failed and redirected navigations** save nothing wrong and restore nothing.
16. **SSR.** No `window`/`document` access during server rendering, no hydration warnings.
17. **Page transitions.** Back to a Nuxt page with a page transition, from a page without one, still restores. Nuxt resolves its transition promise only when a leave transition ends, so then it never resolves.

## Shape

One npm package, three entries:

- `vue-router-scroll-restoration/core`: no framework imports. Finds containers (configured selectors, `'window'` for the document, and any `[data-scroll-restoration-id]` element), captures their positions (a selector keeps the first element it matches, and in development warns once when it matches more), restores a snapshot, and keeps snapshots per key in memory, persisted to `sessionStorage` on `pagehide`. Restoring settles for `settle` milliseconds, until wheel, touch, pointer or key input, or a newer navigation aborts it, or until something else has moved every container. Containers restored to their start don't settle. It checks positions in the frame after the layout may have changed (a DOM change inside a container, a resize of a container or of its children, a scroll, a viewport resize) and does no work between those. It re-applies a position when the container can't scroll that far, as when a section shows a shorter loading state, when its height changed and it still holds the last position restoration applied, or when it moved toward the start after a removal or an attribute or text change inside it, which is how a section swapped for a shorter state and back between two frames shows up. It leaves a container alone once something else moves it to an unclamped position, even if its height changed in the same frame, as long as the only changes inside it were added nodes. A move the app makes without user input in the same frame as a removal or an attribute or text change is taken for that clamp and re-applied: the browser doesn't tell the two apart, and an app scroll that follows user input has already ended the restore. While it settles it turns off the browser's scroll anchoring (`overflow-anchor: none`) on the restored containers: content that loads above the position after it held can move it without changing the height, and anchoring would follow that content. A hash target is scrolled into view, and the containers that hold it are left to `scrollIntoView`.
- `vue-router-scroll-restoration`: `setupScrollRestoration(router, options)`. It captures in `beforeEach`, while the old page is still on screen, under the key of the entry being left, so Back captures too and Forward restores. Keys come from Vue Router's `history.state.position`; `router.options.history.listen` tells traversals from pushes. Pushes and replaces start at the top (a replaced entry still holds the page it replaced), traversals and reloads restore. Same path and hash keep the position. It also restores the first page when set up after the initial navigation, as Nuxt plugins are.
- `vue-router-scroll-restoration/nuxt`: Nuxt module (`scrollRestoration` config key). Clears Nuxt's `scrollBehavior` through a `router.options` file added with `pages:routerOptions`, right after Nuxt's built-in one so an app's own file still wins (setting it at runtime doesn't hold: Nuxt restores it in `app:created`). Waits for `page:loading:end`, the page transition and one frame, as Nuxt's own `scrollBehavior` does, but at most 1 s for its transition promise: coming from a page without a leave transition, nothing resolves it. A promise that timed out isn't waited on again. Nested pages must render with `<NuxtPage>`, which fires that hook. When the app's own `router.options` sets `scrollBehavior`, the plugin does nothing.

Options: `containers` (default `['window']`), `settle` (default `3000`, `false` restores once), and for plain Vue Router `ready(to, from)` (default `nextTick`). Per route: `meta.scrollToTop: false` or a function, as in Nuxt, and `meta.scrollKey`, read from the matched leaf only, which shares one saved position across every visit to the route, links included. That is what restores an overview through its in-page back link.

Not built yet, from the research (TanStack Router, React Router, SvelteKit): tracking any element that scrolls without configuration, containers that reset on push while others are left alone, a `getKey` option, a per-navigation opt-out through `router.push({ state })`, composables for virtual lists, and an inline script that restores before hydration on reload.

## Lab result

`vue-router/experimental` (5.4) was ruled out by reading its source: positions are keyed by `to.path + to.hash`, `restore(entry, to)` can't tell a push from a traversal, it restores once, and `onRouteRendered` falls back to `afterEach` outside a `<RouterView>`, which is where a Nuxt layout sits. The package keeps its API close (capture and restore per container, `scrollToTop`) so it could move onto it if those gaps close upstream.

`test/e2e/scenarios.spec.ts` covers the 17 scenarios, written from this spec by a separate tester before it read `src/`. All pass on the Nuxt and Vue playgrounds in Chromium and WebKit (scenario 16 is Nuxt only, and scenario 17 only has a transition in Nuxt). The one failure along the way was a fixture rendering a nested Nuxt page with `<RouterView>`, which never fires `page:loading:end`; real apps use `<NuxtPage>`.

## Out of scope

Horizontal scrolling inside grids, virtualised lists that need an item index instead of a pixel offset, and smooth-scroll animation beyond passing `behavior` through.
