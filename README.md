# vue-router-scroll-restoration

Scroll restoration for Vue Router and Nuxt on any scroll container, not only `window`.

Vue Router saves and restores only the window's scroll. Dashboard layouts usually scroll an inner element, so a new page opens wherever the last one was scrolled, and Back lands at the top. This package saves every container's position per history entry and restores it on Back, Forward and reload, waiting for the page to render and re-applying the position while late content loads.

![Plain Vue Router opens the next page halfway down and loses your place on Back; with the package the page opens at the top and Back returns to row 30](./.github/assets/back.gif)

![When the table loads after the page shows, plain Vue Router lands at the top; the package waits for the rows and lands on row 60](./.github/assets/late.gif)

- New pages start at the top, or at the `#hash` target, inside the container.
- Back and Forward restore each visit's position, also after a reload.
- Changing only the query keeps the position.
- User input or a new navigation stops a pending restore.

## Nuxt

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['vue-router-scroll-restoration/nuxt'],
  scrollRestoration: {
    containers: ['window', '[data-scroll-root]'],
  },
})
```

The module replaces Nuxt's `scrollBehavior` and restores after `page:loading:end` and the page transition, the moment Nuxt's own behaviour waits for. An `app/router.options.ts` that sets `scrollBehavior` still takes precedence. Render nested pages with `<NuxtPage>`, which fires that hook; a plain `<RouterView>` doesn't.

## Vue Router

```ts
import { createRouter, createWebHistory } from 'vue-router'
import { setupScrollRestoration } from 'vue-router-scroll-restoration'

const router = createRouter({ history: createWebHistory(), routes })
setupScrollRestoration(router, {
  containers: ['window', '[data-scroll-root]'],
})
```

## Options

| Option | Default | |
| --- | --- | --- |
| `containers` | `['window']` | Selectors of the elements that scroll. `'window'` is the document. |
| `settle` | `3000` | Keep re-applying a restored position while content loads, for at most this many milliseconds. `false` restores once. |
| `ready` | `nextTick` | Vue Router only: resolves when the new page is on screen. |

Elements with `data-scroll-restoration-id="<id>"` are tracked without configuration, for containers inside a page:

```vue
<div data-scroll-restoration-id="sidebar" class="overflow-y-auto">…</div>
```

## Per route

```ts
definePageMeta({
  // leave the scroll alone when navigating to this page (as in Nuxt)
  scrollToTop: false,
  // one saved position for every visit, links included, instead of one per history entry
  scrollKey: 'products',
})
```

`scrollKey` is read from the matched leaf route only, so an overview's key isn't inherited by its child routes. Use it for an overview whose in-page back link should return to where you were. With plain Vue Router, put both in the route's `meta`.

## Size and timings

Minified and gzipped with esbuild, `vue` and `vue-router` external:

| Entry | min | min+gzip |
| --- | --- | --- |
| `vue-router-scroll-restoration` | 2.8 kB | 1.4 kB |
| `vue-router-scroll-restoration/core` | 1.8 kB | 1.0 kB |
| `vue-router-scroll-restoration/nuxt` (client plugin) | 3.1 kB | 1.6 kB |

Medians of 15 runs in Chromium against the production playgrounds:

| | Vue Router | Nuxt |
| --- | --- | --- |
| Back restores the position, after `popstate` | 0.7 ms | 28 ms, after `page:loading:end` and a frame, as Nuxt's own `scrollBehavior` |
| Back to a table that renders 1.5 s later | 1505 ms | 1534 ms |
| Script time per navigation, with / without the package | 0.29 / 0.22 ms | |

## Compared

| | Inner containers | Back and Forward per history entry | Waits for late content | Nuxt | min+gzip |
| --- | --- | --- | --- | --- | --- |
| this package | yes | yes | yes, until it holds or `settle` ms | module | 1.4 kB |
| [`vue-router/experimental`](https://github.com/vuejs/router/blob/main/packages/docs/experimental/scroll-restoration.md) (5.4) | per component, with `capture` and `restore` | keyed by path and hash | no, restores once | no | +0.95 kB in `vue-router` |
| [`vue-router-better-scroller`](https://github.com/antfu/vue-router-better-scroller) | yes | saves only when leaving by link, so Forward lands at the top | no, restores once | no | 0.9 kB |
| [`nuxt-scroll-restoration`](https://github.com/shimizukawa/nuxt-scroll-restoration) | window only | yes, by patching `history.pushState` | retries for 3 s | Nuxt 3 module | 2.2 kB |
