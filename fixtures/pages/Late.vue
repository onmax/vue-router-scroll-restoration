<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import FixtureRows from '../FixtureRows.vue'

// A table that renders in two steps, like a grid that loads its rows after the page shows
const count = ref(0)
const timers: ReturnType<typeof setTimeout>[] = []
onMounted(() => timers.push(setTimeout(() => count.value = 40, 300), setTimeout(() => count.value = 120, 1500)))
onUnmounted(() => timers.forEach(clearTimeout))
</script>

<template>
  <div>
    <h1 data-testid="title">
      Late
    </h1>
    <p data-testid="late-count">
      {{ count }}
    </p>
    <FixtureRows
      :count
      label="Late"
    />
  </div>
</template>
