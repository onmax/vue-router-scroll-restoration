# vue-router-scroll-restoration

Scroll restoration for Vue Router and Nuxt on any scroll container. [SPEC.md](./SPEC.md) is the source of truth for behaviour: its 16 numbered scenarios are the tests in `test/e2e/scenarios.spec.ts`.

## Layout

- `src/runtime/core.ts`: DOM core. No imports from Vue or Vue Router.
- `src/runtime/index.ts`: `setupScrollRestoration` for Vue Router.
- `src/runtime/nuxt/` and `src/module.ts`: the Nuxt module.
- `fixtures/`: pages shared by `playground/` (Nuxt) and `playground-vue/` (Vite + Vue Router).

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
- Keep `core.ts` framework-free so another router adapter stays possible.
- Never touch `window` or `document` during SSR.
- Use conventional commit messages. uppt builds the changelog and the release PR from them.
