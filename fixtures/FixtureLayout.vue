<script setup lang="ts">
const groups = [
  {
    title: 'Pages',
    links: [
      { to: '/', id: 'home', text: 'Home' },
      { to: '/long', id: 'long', text: 'Long' },
      { to: '/other', id: 'other', text: 'Other' },
      { to: '/late', id: 'late', text: 'Late' },
      { to: '/async', id: 'async', text: 'Async' },
      { to: '/items', id: 'items', text: 'Items' },
    ],
  },
  {
    title: 'Edge cases',
    links: [
      { to: '/filters?status=a', id: 'filters', text: 'Filters' },
      { to: '/hash#section-5', id: 'hash', text: 'Hash' },
      { to: '/inner', id: 'inner', text: 'Inner' },
      { to: '/keep', id: 'keep', text: 'Keep' },
      { to: '/keep-function', id: 'keep-function', text: 'Keep function' },
      { to: '/blocked', id: 'blocked', text: 'Blocked' },
      { to: '/redirect', id: 'redirect', text: 'Redirect' },
    ],
  },
]
</script>

<template>
  <div class="layout">
    <nav>
      <div class="brand">
        <span class="brand-mark">A</span>
        Acme
      </div>
      <template
        v-for="group in groups"
        :key="group.title"
      >
        <p class="nav-group">
          {{ group.title }}
        </p>
        <RouterLink
          v-for="link in group.links"
          :key="link.id"
          :to="link.to"
          :data-testid="`nav-${link.id}`"
        >
          {{ link.text }}
        </RouterLink>
      </template>
    </nav>
    <div data-scroll-root>
      <slot />
    </div>
  </div>
</template>

<style>
:root {
  --ink: #1c1917;
  --muted: #78716c;
  --line: #e7e5e4;
  --panel: #f5f5f4;
  color: var(--ink);
  font: 14px/1.4 system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}
html, body { margin: 0; height: 100%; }
a { color: inherit; }

.layout { display: flex; height: 100vh; }
.layout > nav { flex: none; display: flex; flex-direction: column; gap: 1px; width: 168px; box-sizing: border-box; padding: 12px 10px; overflow-y: auto; background: var(--panel); border-right: 1px solid var(--line); }
.layout > nav a { padding: 5px 8px; border-radius: 6px; color: var(--muted); font-weight: 500; text-decoration: none; }
.layout > nav a:hover { color: var(--ink); }
.layout > nav a.router-link-exact-active { color: var(--ink); background: #fff; box-shadow: 0 0 0 1px var(--line); }
.brand { display: flex; align-items: center; gap: 8px; padding: 2px 8px 10px; font-weight: 650; }
.brand-mark { display: grid; place-items: center; width: 22px; height: 22px; border-radius: 6px; background: var(--ink); color: #fff; font-size: 12px; }
.nav-group { margin: 12px 8px 4px; color: var(--muted); font-size: 11px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; }

[data-scroll-root] { flex: 1; min-width: 0; min-height: 0; overflow-y: auto; }
[data-scroll-root] h1 { margin: 0; padding: 20px 20px 4px; font-size: 20px; font-weight: 650; letter-spacing: -.01em; }
[data-scroll-root] h1 + :not(h1) { margin-top: 12px; }
[data-scroll-root] a:not(.row-label) { display: inline-block; margin: 12px 0 0 20px; color: #1d4ed8; font-weight: 500; }
[data-testid="late-count"] { margin-bottom: 12px; padding: 0 20px; color: var(--muted); font-variant-numeric: tabular-nums; }
[data-testid="late-count"]::after { content: ' rows loaded'; }
</style>
