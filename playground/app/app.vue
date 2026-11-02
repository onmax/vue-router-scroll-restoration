<script setup lang="ts">
import { NuxtPage } from '#components'
import FixtureLayout from '../../fixtures/FixtureLayout.vue'

provide('childView', NuxtPage)
</script>

<template>
  <FixtureLayout>
    <NuxtPage />
  </FixtureLayout>
</template>
