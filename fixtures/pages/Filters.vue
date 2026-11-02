<script setup lang="ts">
import { useRoute } from 'vue-router'
import FixtureRows from '../FixtureRows.vue'

const route = useRoute()
</script>

<template>
  <div>
    <h1 data-testid="title">
      Filters: <span data-testid="status">{{ route.query.status }}</span>
    </h1>
    <FixtureRows
      :count="40"
      label="Filtered"
    />
    <p>
      <RouterLink
        to="/filters?status=a"
        data-testid="filter-a"
      >Status a</RouterLink>
      <RouterLink
        to="/filters?status=b"
        data-testid="filter-b"
      >Status b</RouterLink>
    </p>
    <FixtureRows
      :count="40"
      label="More"
    />
  </div>
</template>
