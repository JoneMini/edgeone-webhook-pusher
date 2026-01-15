<template>
  <UDashboardGroup storage="local" storage-key="dashboard">
    <UDashboardSidebar
      id="sidebar"
      v-model:collapsed="sidebarCollapsed"
      :collapsible="true"
      :min-size="12"
      :max-size="20"
      :default-size="15"
      :collapsed-size="4"
      class="border-r border-gray-200 dark:border-gray-800"
    >
      <template #header="{ collapsed }">
        <div class="flex items-center gap-2 p-4 cursor-pointer" @click="sidebarCollapsed = !sidebarCollapsed">
          <UIcon name="i-heroicons-bolt" class="text-2xl text-primary shrink-0" />
          <span v-if="!collapsed" class="font-semibold text-sm truncate">Webhook Pusher</span>
        </div>
      </template>

      <UNavigationMenu
        :items="menuItems"
        orientation="vertical"
        :ui="{ link: 'px-3 py-2' }"
      />

      <template #footer="{ collapsed }">
        <div class="p-2 space-y-2">
          <!-- Color Mode Toggle -->
          <UButton
            variant="ghost"
            class="w-full"
            :class="collapsed ? 'justify-center' : 'justify-start'"
            @click="toggleColorMode"
          >
            <UIcon :name="colorMode.value === 'dark' ? 'i-heroicons-sun' : 'i-heroicons-moon'" class="text-lg" />
            <span v-if="!collapsed" class="ml-2">{{ colorMode.value === 'dark' ? '浅色模式' : '深色模式' }}</span>
          </UButton>
          
          <!-- User Menu -->
          <UDropdownMenu :items="userMenuItems">
            <UButton
              variant="ghost"
              class="w-full"
              :class="collapsed ? 'justify-center' : 'justify-start'"
            >
              <UIcon name="i-heroicons-user-circle" class="text-lg" />
              <span v-if="!collapsed" class="ml-2">管理员</span>
            </UButton>
          </UDropdownMenu>
        </div>
      </template>
    </UDashboardSidebar>

    <div class="flex-1 flex flex-col min-w-0">
      <!-- Mobile header -->
      <header class="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <UButton
          variant="ghost"
          icon="i-heroicons-bars-3"
          @click="sidebarCollapsed = !sidebarCollapsed"
        />
        <span class="font-medium">{{ pageTitle }}</span>
      </header>

      <main class="flex-1 overflow-auto bg-gray-50 dark:bg-gray-950">
        <slot />
      </main>
    </div>
  </UDashboardGroup>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const toast = useToast();
const colorMode = useColorMode();

const sidebarCollapsed = ref(false);

function toggleColorMode() {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark';
}

const pageTitle = computed(() => {
  const titles: Record<string, string> = {
    '/': '仪表盘',
    '/channels': '渠道管理',
    '/apps': '应用管理',
    '/messages': '消息历史',
    '/api-docs': 'API 文档',
    '/settings': '设置',
  };
  return titles[route.path] || 'Webhook Pusher';
});

const menuItems = computed(() => [
  [{
    label: '仪表盘',
    icon: 'i-heroicons-home',
    to: '/',
    active: route.path === '/',
  }],
  [{
    label: '渠道管理',
    icon: 'i-heroicons-signal',
    to: '/channels',
    active: route.path === '/channels',
  },
  {
    label: '应用管理',
    icon: 'i-heroicons-cube',
    to: '/apps',
    active: route.path === '/apps',
  },
  {
    label: '消息历史',
    icon: 'i-heroicons-chat-bubble-left-right',
    to: '/messages',
    active: route.path === '/messages',
  }],
  [{
    label: 'API 文档',
    icon: 'i-heroicons-book-open',
    to: '/api-docs',
    active: route.path === '/api-docs',
  },
  {
    label: '设置',
    icon: 'i-heroicons-cog-6-tooth',
    to: '/settings',
    active: route.path === '/settings',
  }],
]);

const userMenuItems = [[
  {
    label: '退出登录',
    icon: 'i-heroicons-arrow-right-on-rectangle',
    onSelect: handleLogout,
  },
]];

function handleLogout() {
  auth.logout();
  toast.add({ title: '已退出登录', color: 'success' });
  router.push('/login');
}

// Check responsive on mount
onMounted(() => {
  if (window.innerWidth < 1024) {
    sidebarCollapsed.value = true;
  }
});
</script>
