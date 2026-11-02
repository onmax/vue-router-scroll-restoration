<template>
  <div>
    <h1 data-testid="title">
      Hash
    </h1>
    <section
      v-for="index in 10"
      :id="`section-${index}`"
      :key="index"
      :data-testid="`section-${index}`"
      class="section"
    >
      Section {{ index }}
    </section>
  </div>
</template>

<style>
.section { height: 600px; scroll-margin-top: 40px; border-top: 2px solid #999; }
</style>
