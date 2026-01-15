<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth';

// Initialize auth store on app mount
onMounted(() => {
  const auth = useAuthStore();
  auth.init();
});
</script>

<style>
html, body, #__nuxt {
  margin: 0;
  padding: 0;
  height: 100%;
}
</style>
