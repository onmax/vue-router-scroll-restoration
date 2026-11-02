import { addPlugin, addTemplate, createResolver, defineNuxtModule } from '@nuxt/kit'

export interface ModuleOptions {
  /**
   * Selectors of the elements that scroll, `'window'` for the document. Elements with
   * `data-scroll-restoration-id` are tracked as well.
   * @default ['window']
   */
  containers: string[]
  /**
   * Keep re-applying a restored position while content loads, for at most this many milliseconds.
   * User input or a new navigation stops it. `false` restores once.
   * @default 3000
   */
  settle: number | false
  /** @default 'vue-router-scroll-restoration' */
  storageKey: string
}

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: 'vue-router-scroll-restoration',
    configKey: 'scrollRestoration',
    compatibility: { nuxt: '>=4.0.0' },
  },
  defaults: {
    containers: ['window'],
    settle: 3000,
    storageKey: 'vue-router-scroll-restoration',
  },
  setup(options, nuxt) {
    const resolver = createResolver(import.meta.url)

    const { dst } = addTemplate({
      filename: 'scroll-restoration-options.mjs',
      getContents: () => `export default ${JSON.stringify(options)}`,
    })
    addTemplate({
      filename: 'scroll-restoration-options.d.mts',
      getContents: () => `declare const options: import(${JSON.stringify(resolver.resolve('./module'))}).ModuleOptions\nexport default options\n`,
    })
    nuxt.options.alias['#scroll-restoration-options'] = dst

    // Right after Nuxt's built-in options, so an app's own `router.options` still wins
    nuxt.hook('pages:routerOptions', ({ files }) => {
      const index = files.findIndex(file => !file.optional)
      files.splice(index === -1 ? files.length : index, 0, { path: resolver.resolve('./runtime/nuxt/router.options') })
    })
    addPlugin({ src: resolver.resolve('./runtime/nuxt/plugin.client'), mode: 'client' })
  },
})
