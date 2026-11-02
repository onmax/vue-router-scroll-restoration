<script setup lang="ts">
import FixtureLayout from '../fixtures/FixtureLayout.vue'
</script>

<template>
  <FixtureLayout>
    <RouterView v-slot="{ Component }">
      <Suspense>
        <component :is="Component" />
      </Suspense>
    </RouterView>
  </FixtureLayout>
</template>
