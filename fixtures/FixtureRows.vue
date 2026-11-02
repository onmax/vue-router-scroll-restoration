<script setup lang="ts">
withDefaults(defineProps<{ count?: number, label?: string, to?: (index: number) => string }>(), { count: 100, label: 'Row' })
</script>

<template>
  <div>
    <div
      v-for="index in count"
      :key="index"
      class="row"
      :data-testid="`row-${index}`"
    >
      <RouterLink
        v-if="to"
        :to="to(index)"
      >
        {{ label }} {{ index }}
      </RouterLink>
      <template v-else>
        {{ label }} {{ index }}
      </template>
    </div>
  </div>
</template>
