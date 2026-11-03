<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import FixtureRows from '../FixtureRows.vue'

// A block that appears above the fold after the page settled, while a spacer below shrinks by the
// same height, like a card that fills in late. The container's scrollHeight never changes.
const shown = ref(false)
let timer: ReturnType<typeof setTimeout>
onMounted(() => timer = setTimeout(() => shown.value = true, 800))
onUnmounted(() => clearTimeout(timer))
</script>

<template>
  <div>
    <h1 data-testid="title">
      Shift
    </h1>
    <div
      :style="{ height: shown ? '24px' : '0px' }"
      :data-testid="shown ? 'shift-shown' : undefined"
    />
    <FixtureRows label="Shift" />
    <div :style="{ height: shown ? '0px' : '24px' }" />
  </div>
</template>
