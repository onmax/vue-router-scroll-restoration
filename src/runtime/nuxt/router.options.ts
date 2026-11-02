import type { RouterConfig } from 'nuxt/schema'

// The plugin restores scroll; Nuxt's own scrollBehavior would scroll the window as well
export default <RouterConfig>{
  scrollBehavior: undefined,
}
