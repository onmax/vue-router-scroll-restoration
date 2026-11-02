<script setup lang="ts">
import FixtureRows from '../FixtureRows.vue'

declare function definePageMeta(meta: { scrollToTop: () => boolean }): void

// Nuxt extracts this macro; the plain Vue playground uses routes.ts.
if (typeof definePageMeta === 'function')
  definePageMeta({ scrollToTop: () => false })
</script>

<template>
  <div>
    <h1 data-testid="title">
      Keep
    </h1>
    <FixtureRows label="Keep function" />
  </div>
</template>
