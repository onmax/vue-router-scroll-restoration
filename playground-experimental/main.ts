import type { Component } from 'vue'
import type { RouteRecordRaw } from 'vue-router'
import type { FixtureRoute } from '../fixtures/routes'
import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import { SCROLL_RESTORATION_CAPTURE_DEFAULT, SCROLL_RESTORATION_RESTORE_DEFAULT, ScrollRestoration } from 'vue-router/experimental'
import { routes } from '../fixtures/routes'
import App from './App.vue'

// The same pages as playground-vue, restored only with vue-router/experimental.
// `--mode plain` is the API as documented; `--mode workarounds` adds what it
// takes to pass more scenarios without changing vue-router (see ScrollRestorer.vue).
const pages = import.meta.glob<Component>('../fixtures/pages/*.vue')

function toRecord({ path, page, redirect, meta, children }: FixtureRoute): RouteRecordRaw {
  if (redirect)
    return { path, redirect }
  return { path, meta, component: pages[`../fixtures/pages/${page}.vue`]!, children: children?.map(toRecord) }
}

const router = createRouter({ history: createWebHistory(), routes: routes.map(toRecord) })
router.beforeEach(to => !to.meta.blocked)

createApp(App)
  .use(ScrollRestoration, { router, capture: SCROLL_RESTORATION_CAPTURE_DEFAULT, restore: SCROLL_RESTORATION_RESTORE_DEFAULT })
  .use(router)
  .mount('#app')
