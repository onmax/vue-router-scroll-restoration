export default defineNuxtPlugin(() => {
  useRouter().beforeEach(to => !to.meta.blocked)
})
