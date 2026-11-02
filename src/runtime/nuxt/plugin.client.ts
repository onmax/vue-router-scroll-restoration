import { defineNuxtPlugin, useRouter } from '#app'
import routerOptions from '#build/router.options.mjs'
import options from '#scroll-restoration-options'
import { setupScrollRestoration } from '../index'

export default defineNuxtPlugin({
  name: 'vue-router-scroll-restoration',
  setup(nuxtApp) {
    // The module clears Nuxt's own scrollBehavior, so one still set is the app's, and it wins
    if (routerOptions.scrollBehavior)
      return

    // Nuxt resolves its transition promise when a leave transition ends. Coming from a page
    // without one, nothing resolves it, so wait at most 1 s, and not again on one that timed out.
    const stale = new WeakSet<Promise<void>>()
    const transitionEnd = async () => {
      const transition: Promise<void> | undefined = nuxtApp['~transitionPromise']
      if (!transition || stale.has(transition))
        return
      const timeout = new Promise<false>(resolve => setTimeout(resolve, 1000, false))
      if (!await Promise.race([transition.then(() => true), timeout]))
        stale.add(transition)
    }

    setupScrollRestoration(useRouter(), {
      ...options,
      // The same moment Nuxt's own scrollBehavior waits for: the page rendered, its transition done
      ready: () => new Promise(resolve => nuxtApp.hooks.hookOnce('page:loading:end', async () => {
        await transitionEnd()
        requestAnimationFrame(resolve)
      })),
    })
  },
})
