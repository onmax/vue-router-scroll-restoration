import type { Component } from 'vue'
import type { RouteRecordRaw } from 'vue-router'
import type { FixtureRoute } from '../fixtures/routes'
import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import { routes } from '../fixtures/routes'
import { setupScrollRestoration } from '../src/runtime/index'
import App from './App.vue'

const pages = import.meta.glob<Component>('../fixtures/pages/*.vue')

function toRecord({ path, page, redirect, meta, children }: FixtureRoute): RouteRecordRaw {
  if (redirect)
    return { path, redirect }
  return { path, meta, component: pages[`../fixtures/pages/${page}.vue`]!, children: children?.map(toRecord) }
}

const router = createRouter({ history: createWebHistory(), routes: routes.map(toRecord) })
router.beforeEach(to => !to.meta.blocked)
setupScrollRestoration(router, { containers: ['window', '[data-scroll-root]'] })

createApp(App).use(router).mount('#app')
