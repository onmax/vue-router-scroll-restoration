import { defineNuxtPlugin, useRouter } from '#app'
import options from '#scroll-restoration-options'
import { setupScrollRestoration } from '../index'

export default defineNuxtPlugin({
  name: 'vue-router-scroll-restoration',
  setup(nuxtApp) {
    setupScrollRestoration(useRouter(), {
      ...options,
      // The same moment Nuxt's own scrollBehavior waits for: the page rendered, its transition done
      ready: () => new Promise(resolve => nuxtApp.hooks.hookOnce('page:loading:end', async () => {
        await nuxtApp['~transitionPromise']
        requestAnimationFrame(resolve)
      })),
    })
  },
})
