<template>
  <div>
    <h1 data-testid="title">
      Hash
    </h1>
    <RouterLink
      to="/hash#secci%C3%B3n-%2541"
      data-testid="hash-encoded"
    >
      Encoded
    </RouterLink>
    <section
      v-for="index in 10"
      :id="`section-${index}`"
      :key="index"
      :data-testid="`section-${index}`"
      class="section"
    >
      Section {{ index }}
    </section>
    <!-- Vue Router decodes the hash once: the id is `sección-%41`, not `sección-A` -->
    <section
      id="sección-%41"
      data-testid="section-encoded"
      class="section"
    >
      Encoded
    </section>
    <div class="section" />
  </div>
</template>

<style>
.section { height: 600px; scroll-margin-top: 40px; border-top: 2px solid #999; }
</style>
