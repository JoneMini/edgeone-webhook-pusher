<template>
  <t-layout>
    <t-aside :width="sidebarCollapsed ? '64px' : '220px'" class="sidebar">
      <div class="logo" @click="sidebarCollapsed = !sidebarCollapsed">
        <Icon icon="mdi:webhook" class="logo-icon" />
        <span v-if="!sidebarCollapsed" class="logo-text">Webhook Pusher</span>
      </div>
      <t-menu
        :value="currentRoute"
        :collapsed="sidebarCollapsed"
        theme="light"
        @change="handleMenuChange"
      >
        <t-menu-item value="/">
          <template #icon><Icon icon="mdi:view-dashboard" /></template>
          仪表盘
        </t-menu-item>
        <t-menu-item value="/sendkeys">
          <template #icon><Icon icon="mdi:key" /></template>
          SendKey 管理
        </t-menu-item>
        <t-menu-item value="/topics">
          <template #icon><Icon icon="mdi:account-group" /></template>
          Topic 管理
        </t-menu-item>
        <t-menu-item value="/messages">
          <template #icon><Icon icon="mdi:message-text" /></template>
          消息历史
        </t-menu-item>
        <t-menu-item value="/settings">
          <template #icon><Icon icon="mdi:cog" /></template>
          设置
        </t-menu-item>
      </t-menu>
    </t-aside>
    <t-layout>
      <t-header class="header">
        <div class="header-content">
          <t-button
            theme="default"
            variant="text"
            class="collapse-btn"
            @click="sidebarCollapsed = !sidebarCollapsed"
          >
            <Icon :icon="sidebarCollapsed ? 'mdi:menu' : 'mdi:menu-open'" />
          </t-button>
          <span class="page-title">{{ pageTitle }}</span>
          <div class="header-actions">
            <t-dropdown :options="userMenuOptions" @click="handleUserMenu">
              <t-button theme="default" variant="text">
                <Icon icon="mdi:account-circle" />
                <span class="user-text">管理员</span>
                <Icon icon="mdi:chevron-down" />
              </t-button>
            </t-dropdown>
          </div>
        </div>
      </t-header>
      <t-content class="main-content">
        <slot />
      </t-content>
    </t-layout>
  </t-layout>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { useAuthStore } from '~/stores/auth';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const sidebarCollapsed = ref(false);
const currentRoute = computed(() => route.path);

const pageTitle = computed(() => {
  const titles: Record<string, string> = {
    '/': '仪表盘',
    '/sendkeys': 'SendKey 管理',
    '/topics': 'Topic 管理',
    '/messages': '消息历史',
    '/settings': '设置',
  };
  
  // Handle dynamic routes
  if (route.path.startsWith('/sendkeys/')) return 'SendKey 详情';
  if (route.path.startsWith('/topics/')) return 'Topic 详情';
  
  return titles[route.path] || 'Webhook Pusher';
});

const userMenuOptions = [
  { content: '退出登录', value: 'logout' },
];

function handleMenuChange(value: string | number) {
  router.push(String(value));
}

function handleUserMenu(data: { value: string }) {
  if (data.value === 'logout') {
    auth.logout();
    MessagePlugin.success('已退出登录');
    router.push('/login');
  }
}

// Check responsive
onMounted(() => {
  if (window.innerWidth < 768) {
    sidebarCollapsed.value = true;
  }
});
</script>

<style scoped>
.sidebar {
  border-right: 1px solid var(--td-component-border);
  transition: width 0.2s;
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px;
  cursor: pointer;
  border-bottom: 1px solid var(--td-component-border);
}

.logo-icon {
  font-size: 28px;
  color: var(--td-brand-color);
  flex-shrink: 0;
}

.logo-text {
  font-size: 14px;
  font-weight: 600;
  color: var(--td-text-color-primary);
  white-space: nowrap;
  overflow: hidden;
}

.header {
  border-bottom: 1px solid var(--td-component-border);
  background: white;
}

.header-content {
  display: flex;
  align-items: center;
  height: 100%;
  padding: 0 16px;
  gap: 12px;
}

.collapse-btn {
  display: none;
}

.page-title {
  font-size: 16px;
  font-weight: 500;
  flex: 1;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-text {
  margin: 0 4px;
}

.main-content {
  padding: 24px;
  background: var(--td-bg-color-page);
  min-height: calc(100vh - 64px);
  overflow-y: auto;
}

@media (max-width: 768px) {
  .collapse-btn {
    display: flex;
  }
  
  .user-text {
    display: none;
  }
}
</style>
