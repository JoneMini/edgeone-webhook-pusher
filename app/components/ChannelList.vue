<template>
  <div class="space-y-2">
    <div
      v-for="channel in channels"
      :key="channel.id"
      class="p-3 rounded-lg cursor-pointer transition-colors"
      :class="[
        selectedId === channel.id
          ? 'bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800'
          : 'hover:bg-gray-100 dark:hover:bg-gray-800 border border-transparent'
      ]"
      @click="$emit('select', channel.id)"
    >
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <UIcon name="i-heroicons-signal" class="text-green-600 dark:text-green-400 text-lg" />
        </div>
        <div class="flex-1 min-w-0">
          <div class="font-medium text-sm truncate">{{ channel.name }}</div>
          <div class="text-xs text-gray-500 dark:text-gray-400 truncate">
            {{ channel.config?.appId || '-' }}
          </div>
        </div>
        <UBadge color="primary" variant="subtle" size="xs">
          {{ channel.type === 'wechat' ? '微信' : channel.type }}
        </UBadge>
      </div>
    </div>

    <div v-if="channels.length === 0" class="text-center py-8 text-gray-500 dark:text-gray-400">
      <UIcon name="i-heroicons-signal-slash" class="text-4xl mb-2 opacity-50" />
      <p class="text-sm">暂无渠道</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Channel } from '~/types';

defineProps<{
  channels: Channel[];
  selectedId: string | null;
}>();

defineEmits<{
  select: [id: string];
}>();
</script>
