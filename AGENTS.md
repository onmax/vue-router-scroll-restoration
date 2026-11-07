# vue-router-scroll-restoration

Scroll restoration for Vue Router and Nuxt on any scroll container. [SPEC.md](./SPEC.md) is the source of truth for behaviour: its 17 numbered scenarios are the tests in `test/e2e/scenarios.spec.ts`.

## Layout

- `src/runtime/core.ts`: DOM core. No imports from Vue or Vue Router.
- `src/runtime/index.ts`: `setupScrollRestoration` for Vue Router.
- `src/runtime/nuxt/` and `src/module.ts`: the Nuxt module.
- `fixtures/`: pages shared by `playground/` (Nuxt) and `playground-vue/` (Vite + Vue Router).
- `playground-experimental/`: the same pages restored with `vue-router/experimental` only, for [EXPERIMENTAL.md](./EXPERIMENTAL.md). `pnpm build:experimental && pnpm test:experimental`; CI doesn't run it.

## Checks

```sh
pnpm install
pnpm lint
pnpm dev:prepare && pnpm typecheck
pnpm check:doctor
pnpm validate          # build + publint
pnpm build:playgrounds
pnpm exec playwright install chromium webkit
pnpm test:e2e
```

## Rules

- A behaviour change starts in SPEC.md, then a scenario test, then the code. Run the e2e tests on both playgrounds and both browsers.
- When a change touches how a restore settles or how it tells app scrolls from the user's, add scenarios for content that changes after load: content that shifts without changing the page height, a loading state shorter than the final page, and a page that shrinks and grows again within one frame. Then check Back and Forward on a page that refetches its grid. #13, #14 and #22 each fixed one of these after the release before passed every scenario.
- Keep `core.ts` framework-free so another router adapter stays possible.
- Never touch `window` or `document` during SSR.
- Use conventional commit messages. uppt builds the changelog and the release PR from them.
