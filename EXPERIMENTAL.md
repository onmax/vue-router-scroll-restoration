# vue-router/experimental lab

Can the scenarios in [SPEC.md](./SPEC.md) pass with only the scroll restoration API in `vue-router/experimental` (vue-router 5.4.0), without this package and without changing vue-router? posva suggested this experiment in [vuejs/router#2871](https://github.com/vuejs/router/issues/2871#issuecomment-6628522530), to see whether the current API is too limiting.

`playground-experimental/` runs the same fixture pages as the other playgrounds. It installs `ScrollRestoration` and calls `useScrollRestoration()` from [`ScrollRestorer.vue`](./playground-experimental/ScrollRestorer.vue), a component rendered inside the `<RouterView>` slot. Under a `<RouterView>`, `onRouteRendered` waits until the page has rendered, Suspense included. No code from `src/` is imported. It builds twice:

- **plain.** `useScrollRestoration()` as documented, with `capture`/`restore` for the window, `[data-scroll-root]` and every `[data-scroll-restoration-id]` element, the default `path + hash` key, and `meta.scrollKey`/`meta.scrollToTop` read in `key` and `restore`.
- **workarounds.** The same, plus the code it took to make every scenario pass, still on the public API only.

```sh
pnpm build:experimental
pnpm test:experimental
```

## Result

Chromium and WebKit, 34 tests each. The config leaves out 3 tests that check this package's own dev warning and sessionStorage format, and the SSR test skips because the playground is client-rendered.

| | plain | workarounds |
| --- | --- | --- |
| Chromium | 24 pass, 10 fail | 34 pass |
| WebKit | 23 pass, 11 fail | 34 pass |

Tests that fail with plain, all of which pass with workarounds:

| Test | Chromium | WebKit |
| --- | --- | --- |
| 1. a link to a page visited before starts at the top | ✗ | ✗ |
| 4. late content restores after both growth stages | ✗ | ✗ |
| 4. content that moves the saved position without changing the height restores | ✗ | ✗ |
| 4. content swapped for a shorter state and back between two frames restores | ✗ | ✗ |
| 4. content swapped for a shorter state and back between two frames restores as it grows | ✗ | ✗ |
| 4. a restore that holds its position does no work until the layout changes | ✗ | ✗ |
| 4. a page that shrinks while it reloads restores once it grows back | ✓ | ✗ |
| 6. restores anchoring for a container matched twice (after input, navigation, timeout) | ✗ ×3 | ✗ ×3 |
| 6. user input while the page is still loading cancels its restore | ✗ | ✗ |

Back, Forward, reload, hash links, query-only changes, several containers, a container rendered by the page, `meta.scrollToTop`, the overview/child routes with a shared key, and blocked and redirected navigations all pass with plain.

## What the workarounds needed

Each one is marked in `ScrollRestorer.vue`.

1. **A key per history entry** (about 5 lines). `key(route)` only gets the route, and the plugin captures in `afterEach`, when `history.state` already belongs to the new entry. So the component keeps a `WeakMap` from each route object to the `history.state.position` it was shown in, filled from its own `afterEach`. If `key` also got the history entry, or capture ran before the entry changes, this would go away.
2. **Telling a link from Back/Forward** (about 20 lines). `restore(entry, to)` gets neither `from` nor the navigation type. The component listens to `router.options.history.listen` for traversals, reads `performance` navigation timing for reloads, and remembers `from` in `afterEach`. Links then start at the top, even when Back pruned the entry whose index they take, and same-path links keep the position. `meta.scrollToTop` functions need `from` too, so plain also tracks it.
3. **Re-applying while content loads** (about 50 lines). `restore` runs once, and nothing calls `scroll()` again when a table's rows arrive, so the position stays clamped. Calling `scroll()` from the page when its data loads works for one page, but a layout doesn't know when that is, and a late `scroll()` overwrites wherever the user has scrolled since. So for 3 s after a restore, the component re-applies the position after DOM changes and scrolls. It stops on input, and when something else moves a container to a position it could have stayed at. It also turns off `overflow-anchor` while it re-applies.
4. **Input while the page loads** (about 12 lines). The restore runs once the page renders, even if the user has scrolled since the navigation started. The component skips it when there was wheel, touch, pointer or key input since `beforeEach`.

Workarounds 1 and 2 cover what the API doesn't expose, and look like small API additions. Workaround 3 is most of this package's core, written again, and workaround 4 depends on it.
