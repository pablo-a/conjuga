<script setup lang="ts">
import AppNav from '@/components/AppNav.vue'
</script>

<template>
  <div class="flex h-full flex-col">
    <main class="mx-auto w-full max-w-2xl flex-1 overflow-y-auto px-4 pt-6 pb-24">
      <RouterView />
    </main>
    <AppNav />
  </div>
</template>
