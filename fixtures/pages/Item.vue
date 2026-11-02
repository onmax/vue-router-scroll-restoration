<script setup lang="ts">
import { useRoute } from 'vue-router'
import FixtureRows from '../FixtureRows.vue'

const route = useRoute()
</script>

<template>
  <div>
    <RouterLink
      to="/items"
      data-testid="back-to-overview"
    >Back to items</RouterLink>
    <h1 data-testid="title">
      Item {{ route.params.id }}
    </h1>
    <FixtureRows
      :count="60"
      label="Detail"
    />
  </div>
</template>
