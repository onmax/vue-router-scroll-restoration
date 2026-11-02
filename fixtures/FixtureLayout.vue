<template>
  <div class="layout">
    <nav>
      <RouterLink
        to="/"
        data-testid="nav-home"
      >Home</RouterLink>
      <RouterLink
        to="/long"
        data-testid="nav-long"
      >Long</RouterLink>
      <RouterLink
        to="/other"
        data-testid="nav-other"
      >Other</RouterLink>
      <RouterLink
        to="/late"
        data-testid="nav-late"
      >Late</RouterLink>
      <RouterLink
        to="/async"
        data-testid="nav-async"
      >Async</RouterLink>
      <RouterLink
        to="/filters?status=a"
        data-testid="nav-filters"
      >Filters</RouterLink>
      <RouterLink
        to="/hash#section-5"
        data-testid="nav-hash"
      >Hash</RouterLink>
      <RouterLink
        to="/inner"
        data-testid="nav-inner"
      >Inner</RouterLink>
      <RouterLink
        to="/keep"
        data-testid="nav-keep"
      >Keep</RouterLink>
      <RouterLink
        to="/keep-function"
        data-testid="nav-keep-function"
      >Keep function</RouterLink>
      <RouterLink
        to="/items"
        data-testid="nav-items"
      >Items</RouterLink>
      <RouterLink
        to="/blocked"
        data-testid="nav-blocked"
      >Blocked</RouterLink>
      <RouterLink
        to="/redirect"
        data-testid="nav-redirect"
      >Redirect</RouterLink>
    </nav>
    <div data-scroll-root>
      <slot />
    </div>
  </div>
</template>

<style>
html, body { margin: 0; height: 100%; font: 14px/1.4 system-ui, sans-serif; }
.layout { display: flex; flex-direction: column; height: 100vh; }
.layout > nav { flex: none; display: flex; gap: 12px; height: 40px; align-items: center; padding: 0 12px; overflow-x: auto; white-space: nowrap; border-bottom: 1px solid #ddd; }
[data-scroll-root] { flex: 1; min-height: 0; overflow-y: auto; }
.row { height: 50px; box-sizing: border-box; padding: 0 12px; display: flex; align-items: center; border-bottom: 1px solid #eee; }
</style>
