<script setup lang="ts">
import FixtureRows from '../FixtureRows.vue'

declare function definePageMeta(meta: { pageTransition: { name: string, mode: 'out-in' } }): void

// Nuxt extracts this macro; the plain Vue playground has no page transitions.
// Coming back here from a page without a transition, Nuxt's transition promise never resolves.
if (typeof definePageMeta === 'function')
  definePageMeta({ pageTransition: { name: 'fade', mode: 'out-in' } })

await new Promise(resolve => setTimeout(resolve, 400))
</script>

<template>
  <div>
    <h1 data-testid="title">
      Fade
    </h1>
    <FixtureRows label="Fade" />
  </div>
</template>

<style>
.fade-enter-active, .fade-leave-active { transition: opacity 300ms; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
