<template>
  <div class="api-docs-container" :class="{ 'dark-mode': isDark }">
    <ApiReference :configuration="config" />
  </div>
</template>

<script setup lang="ts">
import { ApiReference } from '@scalar/api-reference'
import '@scalar/api-reference/style.css'
import type { ReferenceConfiguration } from '@scalar/api-reference'

definePageMeta({
  layout: 'default',
})

const colorMode = useColorMode()
const isDark = computed(() => colorMode.value === 'dark')

const config = computed<ReferenceConfiguration>(() => ({
  spec: {
    url: '/openapi.json',
  },
  darkMode: isDark.value,
  hideModels: false,
  hideDownloadButton: false,
  hideDarkModeToggle: true,
  defaultHttpClient: {
    targetKey: 'shell',
    clientKey: 'curl',
  },
}))
</script>

<style scoped>
.api-docs-container {
  height: 100%;
  overflow: auto;
}

/* Light mode overrides */
.api-docs-container:not(.dark-mode) :deep(.scalar-api-reference) {
  --scalar-background-1: #ffffff;
  --scalar-background-2: #f8fafc;
  --scalar-background-3: #f1f5f9;
  --scalar-color-1: #1e293b;
  --scalar-color-2: #475569;
  --scalar-color-3: #64748b;
  --scalar-border-color: #e2e8f0;
}

/* Dark mode overrides */
.api-docs-container.dark-mode :deep(.scalar-api-reference) {
  --scalar-background-1: #0a0a0a;
  --scalar-background-2: #171717;
  --scalar-background-3: #262626;
  --scalar-color-1: #fafafa;
  --scalar-color-2: #a1a1aa;
  --scalar-color-3: #71717a;
  --scalar-border-color: #27272a;
}
</style>
