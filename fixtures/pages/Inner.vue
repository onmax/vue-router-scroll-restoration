<script setup lang="ts">
import FixtureRows from '../FixtureRows.vue'
</script>

<template>
  <div>
    <h1 data-testid="title">
      Inner
    </h1>
    <div
      data-scroll-restoration-id="inner"
      data-testid="inner"
      class="inner"
    >
      <FixtureRows label="Inner" />
    </div>
    <FixtureRows label="Outer" />
  </div>
</template>

<style>
.inner { height: 300px; margin: 0 20px 20px; overflow-y: auto; border: 1px solid var(--line); border-radius: 8px; }
</style>
