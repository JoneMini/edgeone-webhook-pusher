<template>
  <div class="p-6">
    <div class="space-y-6">
      <!-- Stats Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <UCard class="relative">
          <div class="flex items-center gap-4">
            <div class="w-14 h-14 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <UIcon name="i-heroicons-signal" class="text-2xl text-green-600 dark:text-green-400" />
            </div>
            <div>
              <div class="text-3xl font-bold">{{ stats.channels }}</div>
              <div class="text-sm text-gray-500 dark:text-gray-400">渠道</div>
            </div>
          </div>
          <NuxtLink to="/channels" class="absolute right-4 bottom-4">
            <UButton variant="ghost" size="xs" trailing-icon="i-heroicons-arrow-right">
              管理
            </UButton>
          </NuxtLink>
        </UCard>

        <UCard class="relative">
          <div class="flex items-center gap-4">
            <div class="w-14 h-14 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <UIcon name="i-heroicons-cube" class="text-2xl text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div class="text-3xl font-bold">{{ stats.apps }}</div>
              <div class="text-sm text-gray-500 dark:text-gray-400">应用</div>
            </div>
          </div>
          <NuxtLink to="/apps" class="absolute right-4 bottom-4">
            <UButton variant="ghost" size="xs" trailing-icon="i-heroicons-arrow-right">
              管理
            </UButton>
          </NuxtLink>
        </UCard>

        <UCard class="relative">
          <div class="flex items-center gap-4">
            <div class="w-14 h-14 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
              <UIcon name="i-heroicons-chat-bubble-left-right" class="text-2xl text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <div class="text-3xl font-bold">{{ stats.messages }}</div>
              <div class="text-sm text-gray-500 dark:text-gray-400">消息总数</div>
            </div>
          </div>
          <NuxtLink to="/messages" class="absolute right-4 bottom-4">
            <UButton variant="ghost" size="xs" trailing-icon="i-heroicons-arrow-right">
              查看
            </UButton>
          </NuxtLink>
        </UCard>

        <UCard>
          <div class="flex items-center gap-4">
            <div class="w-14 h-14 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <UIcon name="i-heroicons-user-group" class="text-2xl text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <div class="text-3xl font-bold">{{ stats.openIds }}</div>
              <div class="text-sm text-gray-500 dark:text-gray-400">订阅者</div>
            </div>
          </div>
        </UCard>
      </div>

      <!-- Quick Actions -->
      <UCard>
        <template #header>
          <span class="font-medium">快捷操作</span>
        </template>
        <div class="flex flex-wrap gap-3">
          <NuxtLink to="/channels">
            <UButton icon="i-heroicons-plus">
              新建渠道
            </UButton>
          </NuxtLink>
          <NuxtLink to="/apps">
            <UButton variant="outline" icon="i-heroicons-plus">
              新建应用
            </UButton>
          </NuxtLink>
          <NuxtLink to="/settings">
            <UButton variant="ghost" icon="i-heroicons-cog-6-tooth">
              系统设置
            </UButton>
          </NuxtLink>
        </div>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { StatsData } from '~/types';

definePageMeta({
  layout: 'default',
});

const api = useApi();

const loading = ref(true);
const stats = ref<StatsData>({
  channels: 0,
  apps: 0,
  openIds: 0,
  messages: 0,
});

onMounted(async () => {
  const res = await api.getStats();
  loading.value = false;
  
  if (res.code === 0 && res.data) {
    stats.value = res.data;
  }
});
</script>
