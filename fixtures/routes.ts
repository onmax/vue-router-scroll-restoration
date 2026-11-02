// The playgrounds' route table. The Nuxt playground adds it with `pages:extend`,
// the Vite playground with `createRouter`, so both run the same pages.
export interface FixtureRoute {
  path: string
  page?: string
  redirect?: string
  meta?: Record<string, unknown>
  children?: FixtureRoute[]
}

export const routes: FixtureRoute[] = [
  { path: '/', page: 'Home' },
  { path: '/long', page: 'Long' },
  { path: '/other', page: 'Other' },
  { path: '/late', page: 'Late' },
  { path: '/async', page: 'Async' },
  { path: '/filters', page: 'Filters' },
  { path: '/hash', page: 'Hash' },
  { path: '/inner', page: 'Inner' },
  { path: '/keep', page: 'Keep', meta: { scrollToTop: false } },
  { path: '/blocked', page: 'Other', meta: { blocked: true } },
  { path: '/redirect', redirect: '/other' },
  { path: '/items', page: 'Items', meta: { scrollKey: 'items' }, children: [{ path: ':id', page: 'Item' }] },
]
