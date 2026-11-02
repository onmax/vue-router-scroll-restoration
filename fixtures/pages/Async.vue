<script setup lang="ts">
import FixtureRows from '../FixtureRows.vue'

await new Promise(resolve => setTimeout(resolve, 400))
</script>

<template>
  <div>
    <h1 data-testid="title">
      Async
    </h1>
    <FixtureRows label="Async" />
  </div>
</template>
