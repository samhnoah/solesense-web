<script setup lang="ts">
import SiteHeader from './components/SiteHeader.vue'
</script>

<template>
  <SiteHeader />
  <RouterView v-slot="{ Component }">
    <Transition name="page" mode="out-in">
      <component :is="Component" />
    </Transition>
  </RouterView>
</template>
