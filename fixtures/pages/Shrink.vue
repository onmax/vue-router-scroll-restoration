<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import FixtureRows from '../FixtureRows.vue'

// A chart that shows a short loading state while it refetches, after the page first rendered tall.
// While it is short the container can't scroll as far as the saved position.
const loading = ref(false)
const done = ref(false)
const timers: ReturnType<typeof setTimeout>[] = []
onMounted(() => timers.push(
  setTimeout(() => loading.value = true, 500),
  setTimeout(() => {
    loading.value = false
    done.value = true
  }, 1200),
))
onUnmounted(() => timers.forEach(clearTimeout))
</script>

<template>
  <div>
    <h1 data-testid="title">
      Shrink
    </h1>
    <FixtureRows
      :count="40"
      label="Shrink"
    />
    <div
      :style="{ height: loading ? '100px' : '600px' }"
      :data-testid="done ? 'shrink-done' : undefined"
    />
  </div>
</template>
