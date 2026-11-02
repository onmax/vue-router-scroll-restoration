<script setup lang="ts">
import type { Component } from 'vue'
import { computed, inject } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import FixtureRows from '../FixtureRows.vue'

// Like Portal's OverviewWithChild: the overview stays mounted but hidden while a child shows.
// Nuxt renders nested pages with <NuxtPage>, which the Nuxt playground provides.
const ChildView = inject<Component>('childView', RouterView)
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
    <ChildView />
  </div>
</template>
