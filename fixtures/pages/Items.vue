<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import FixtureRows from '../FixtureRows.vue'

// Like Portal's OverviewWithChild: the overview stays mounted but hidden while a child shows
const route = useRoute()
const isChild = computed(() => route.matched.length > 1)
</script>

<template>
  <div>
    <div
      v-show="!isChild"
      data-testid="overview"
    >
      <h1 data-testid="title">
        Items
      </h1>
      <FixtureRows
        label="Item"
        :to="index => `/items/${index}`"
      />
    </div>
    <RouterView />
  </div>
</template>
