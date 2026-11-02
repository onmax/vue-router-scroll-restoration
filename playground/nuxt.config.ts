import type { NuxtPage } from 'nuxt/schema'
import type { FixtureRoute } from '../fixtures/routes'
import { fileURLToPath } from 'node:url'
import { routes } from '../fixtures/routes'

function toPage({ page, children, ...route }: FixtureRoute): NuxtPage {
  return {
    ...route,
    file: page && fileURLToPath(new URL(`../fixtures/pages/${page}.vue`, import.meta.url)),
    children: children?.map(toPage),
  }
}

export default defineNuxtConfig({
  modules: ['../src/module'],
  pages: true,
  devtools: { enabled: false },
  compatibilityDate: '2026-10-01',
  hooks: {
    'pages:extend': pages => void pages.push(...routes.map(toPage)),
  },
  scrollRestoration: {
    containers: ['window', '[data-scroll-root]'],
  },
})
