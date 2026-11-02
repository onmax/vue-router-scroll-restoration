<script setup lang="ts">
withDefaults(defineProps<{ count?: number, label?: string, to?: (index: number) => string }>(), { count: 100, label: 'Row' })

// Made-up table cells, the same on every render, so the rows look like a real dashboard's
const statuses = ['Paid', 'Pending', 'Paid', 'Refunded', 'Paid'] as const
const amount = (index: number) => `$${((index * 7919) % 90000 / 100 + 12).toFixed(2)}`
</script>

<template>
  <div class="rows">
    <div
      v-for="index in count"
      :key="index"
      class="row"
      :data-testid="`row-${index}`"
    >
      <span class="row-index">{{ index }}</span>
      <RouterLink
        v-if="to"
        :to="to(index)"
        class="row-label"
      >
        {{ label }} {{ index }}
      </RouterLink>
      <span
        v-else
        class="row-label"
      >
        {{ label }} {{ index }}
      </span>
      <span :class="`row-status row-status-${statuses[index % statuses.length]!.toLowerCase()}`">{{ statuses[index % statuses.length] }}</span>
      <span class="row-amount">{{ amount(index) }}</span>
    </div>
  </div>
</template>

<style>
.rows { border-top: 1px solid var(--line); }
.row { display: flex; align-items: center; gap: 12px; height: 50px; box-sizing: border-box; padding: 0 20px; border-bottom: 1px solid var(--line); font-variant-numeric: tabular-nums; }
.row-index { width: 28px; color: var(--muted); font-size: 12px; }
.row-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; }
a.row-label { text-decoration: none; }
a.row-label:hover { text-decoration: underline; }
.row-status { padding: 1px 8px; border-radius: 999px; font-size: 12px; font-weight: 500; }
.row-status-paid { background: #dcfce7; color: #166534; }
.row-status-pending { background: #fef3c7; color: #92400e; }
.row-status-refunded { background: var(--panel); color: var(--muted); }
.row-amount { width: 72px; text-align: right; color: var(--muted); }
</style>
