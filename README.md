# vue-router-scroll-restoration

Scroll restoration for Vue Router and Nuxt on any scroll container, not only `window`.

Vue Router saves and restores only the window's scroll. Dashboard layouts usually scroll an inner element, so Back lands at the top. This package saves every container's position per history entry and restores it on Back, Forward and reload, waiting for the page to render and re-applying the position while late content loads.

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
| `storageKey` | `'vue-router-scroll-restoration'` | `sessionStorage` key for positions kept across reloads. |

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
