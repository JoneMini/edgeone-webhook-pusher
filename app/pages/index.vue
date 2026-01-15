<template>
  <div class="dashboard">
    <t-row :gutter="[24, 24]">
      <!-- Stats Cards -->
      <t-col :xs="24" :sm="8">
        <t-card :bordered="false" class="stat-card">
          <div class="stat-content">
            <div class="stat-icon channel">
              <Icon icon="mdi:broadcast" />
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.channelCount }}</div>
              <div class="stat-label">渠道</div>
            </div>
          </div>
          <t-button
            theme="primary"
            variant="text"
            class="stat-action"
            @click="router.push('/channels')"
          >
            管理 <Icon icon="mdi:arrow-right" />
          </t-button>
        </t-card>
      </t-col>

      <t-col :xs="24" :sm="8">
        <t-card :bordered="false" class="stat-card">
          <div class="stat-content">
            <div class="stat-icon app">
              <Icon icon="mdi:application" />
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.appCount }}</div>
              <div class="stat-label">应用</div>
            </div>
          </div>
          <t-button
            theme="primary"
            variant="text"
            class="stat-action"
            @click="router.push('/apps')"
          >
            管理 <Icon icon="mdi:arrow-right" />
          </t-button>
        </t-card>
      </t-col>

      <t-col :xs="24" :sm="8">
        <t-card :bordered="false" class="stat-card">
          <div class="stat-content">
            <div class="stat-icon message">
              <Icon icon="mdi:message-text" />
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.messageCount }}</div>
              <div class="stat-label">消息总数</div>
            </div>
          </div>
          <t-button
            theme="primary"
            variant="text"
            class="stat-action"
            @click="router.push('/messages')"
          >
            查看 <Icon icon="mdi:arrow-right" />
          </t-button>
        </t-card>
      </t-col>

      <!-- Quick Actions -->
      <t-col :span="24">
        <t-card title="快捷操作" :bordered="false">
          <t-space>
            <t-button theme="primary" @click="router.push('/channels')">
              <template #icon><Icon icon="mdi:plus" /></template>
              新建渠道
            </t-button>
            <t-button theme="default" @click="router.push('/apps')">
              <template #icon><Icon icon="mdi:plus" /></template>
              新建应用
            </t-button>
            <t-button theme="default" variant="outline" @click="router.push('/settings')">
              <template #icon><Icon icon="mdi:cog" /></template>
              系统设置
            </t-button>
          </t-space>
        </t-card>
      </t-col>

      <!-- Recent Messages -->
      <t-col :span="24">
        <t-card :bordered="false">
          <template #header>
            <div class="card-header">
              <span>最近消息</span>
              <t-button
                theme="default"
                variant="text"
                @click="router.push('/messages')"
              >
                查看全部 <Icon icon="mdi:arrow-right" />
              </t-button>
            </div>
          </template>

          <t-loading :loading="loading">
            <t-table
              v-if="stats.recentMessages.length > 0"
              :data="stats.recentMessages"
              :columns="messageColumns"
              row-key="id"
              hover
              size="small"
            >
              <template #success="{ row }">
                <t-tag :theme="row.success ? 'success' : 'danger'" variant="light" size="small">
                  <Icon :icon="row.success ? 'mdi:check' : 'mdi:close'" />
                  {{ row.success ? '成功' : '失败' }}
                </t-tag>
              </template>
              <template #createdAt="{ row }">
                {{ formatTime(row.createdAt) }}
              </template>
            </t-table>
            <t-empty v-else description="暂无消息记录" />
          </t-loading>
        </t-card>
      </t-col>
    </t-row>
  </div>
</template>

<script setup lang="ts">
import type { StatsData } from '~/composables/useApi';
import { Icon } from '@iconify/vue';

definePageMeta({
  layout: 'default',
});

const api = useApi();
const router = useRouter();

const loading = ref(true);
const stats = ref<StatsData>({
  channelCount: 0,
  appCount: 0,
  messageCount: 0,
  recentMessages: [],
});

const messageColumns = [
  { colKey: 'title', title: '标题', ellipsis: true },
  { colKey: 'success', title: '状态', width: 80, cell: 'success' },
  { colKey: 'createdAt', title: '时间', width: 160, cell: 'createdAt' },
];

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('zh-CN');
}

onMounted(async () => {
  const res = await api.getStats();
  loading.value = false;
  
  if (res.code === 0 && res.data) {
    stats.value = res.data;
  }
});
</script>

<style scoped>
.dashboard {
  max-width: 1200px;
}

.stat-card {
  position: relative;
}

.stat-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.stat-icon {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
}

.stat-icon.channel {
  background: rgba(7, 193, 96, 0.1);
  color: #07c160;
}

.stat-icon.app {
  background: rgba(0, 82, 217, 0.1);
  color: #0052d9;
}

.stat-icon.message {
  background: rgba(237, 123, 47, 0.1);
  color: #ed7b2f;
}

.stat-info {
  flex: 1;
}

.stat-value {
  font-size: 28px;
  font-weight: 600;
  line-height: 1.2;
}

.stat-label {
  color: var(--td-text-color-secondary);
  font-size: 14px;
  margin-top: 4px;
}

.stat-action {
  position: absolute;
  right: 16px;
  bottom: 16px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
