<script setup lang="ts">
import FixtureLayout from '../fixtures/FixtureLayout.vue'
import ScrollRestorer from './ScrollRestorer.vue'
</script>

<template>
  <FixtureLayout>
    <!-- ScrollRestorer sits under the RouterView, so onRouteRendered waits for the page -->
    <RouterView v-slot="{ Component }">
      <ScrollRestorer />
      <Suspense>
        <component :is="Component" />
      </Suspense>
    </RouterView>
  </FixtureLayout>
</template>
