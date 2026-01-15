<template>
  <div class="space-y-2">
    <div
      v-for="app in apps"
      :key="app.id"
      class="p-3 rounded-lg cursor-pointer transition-colors"
      :class="[
        selectedId === app.id
          ? 'bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800'
          : 'hover:bg-gray-100 dark:hover:bg-gray-800 border border-transparent'
      ]"
      @click="$emit('select', app.id)"
    >
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
          <UIcon name="i-heroicons-cube" class="text-blue-600 dark:text-blue-400 text-lg" />
        </div>
        <div class="flex-1 min-w-0">
          <div class="font-medium text-sm truncate">{{ app.name }}</div>
          <div class="text-xs text-gray-500 dark:text-gray-400 truncate flex items-center gap-1">
            <UIcon name="i-heroicons-key" class="text-xs" />
            {{ app.key }}
          </div>
        </div>
      </div>
      <div class="flex gap-1 mt-2">
        <UBadge :color="app.pushMode === 'single' ? 'primary' : 'info'" variant="subtle" size="xs">
          {{ app.pushMode === 'single' ? '单播' : '订阅' }}
        </UBadge>
        <UBadge :color="app.messageType === 'template' ? 'warning' : 'neutral'" variant="subtle" size="xs">
          {{ app.messageType === 'template' ? '模板消息' : '普通消息' }}
        </UBadge>
      </div>
    </div>

    <div v-if="apps.length === 0" class="text-center py-8 text-gray-500 dark:text-gray-400">
      <UIcon name="i-heroicons-cube-transparent" class="text-4xl mb-2 opacity-50" />
      <p class="text-sm">暂无应用</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AppWithCount } from '~/types';

defineProps<{
  apps: AppWithCount[];
  selectedId: string | null;
}>();

defineEmits<{
  select: [id: string];
}>();
</script>
