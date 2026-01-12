<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { MessagePlugin, DialogPlugin } from 'tdesign-vue-next';

definePageMeta({
  layout: 'default',
});

const api = useApi();

// State
const loading = ref(true);
const topics = ref<any[]>([]);
const showCreateDialog = ref(false);
const createForm = ref({ name: '' });
const creating = ref(false);

// Fetch topics
async function fetchTopics() {
  loading.value = true;
  try {
    const res = await api.getTopics();
    topics.value = res.data || [];
  } catch (e: any) {
    MessagePlugin.error(e.message || '获取 Topic 列表失败');
  } finally {
    loading.value = false;
  }
}

// Create topic
async function handleCreate() {
  if (!createForm.value.name.trim()) {
    MessagePlugin.warning('请输入名称');
    return;
  }
  creating.value = true;
  try {
    await api.createTopic({ name: createForm.value.name.trim() });
    MessagePlugin.success('创建成功');
    showCreateDialog.value = false;
    createForm.value.name = '';
    await fetchTopics();
  } catch (e: any) {
    MessagePlugin.error(e.message || '创建失败');
  } finally {
    creating.value = false;
  }
}

// Delete topic
async function handleDelete(item: any) {
  const dialog = DialogPlugin.confirm({
    header: '确认删除',
    body: `确定要删除 Topic "${item.name}" 吗？此操作不可恢复，所有订阅者将被移除。`,
    confirmBtn: { content: '删除', theme: 'danger' },
    onConfirm: async () => {
      try {
        await api.deleteTopic(item.id);
        MessagePlugin.success('删除成功');
        await fetchTopics();
      } catch (e: any) {
        MessagePlugin.error(e.message || '删除失败');
      }
      dialog.destroy();
    },
  });
}

onMounted(() => {
  fetchTopics();
});
</script>

<template>
  <div class="topics-page">
    <div class="page-header">
      <h1>Topic 管理</h1>
      <t-button theme="primary" @click="showCreateDialog = true">
        <template #icon><Icon icon="mdi:plus" /></template>
        新建 Topic
      </t-button>
    </div>

    <t-loading :loading="loading">
      <div v-if="topics.length === 0 && !loading" class="empty-state">
        <Icon icon="mdi:bullhorn-outline" class="empty-icon" />
        <p>暂无 Topic</p>
        <t-button theme="primary" @click="showCreateDialog = true">创建第一个 Topic</t-button>
      </div>

      <div v-else class="topic-list">
        <t-card v-for="item in topics" :key="item.id" class="topic-card" hover-shadow>
          <div class="card-content">
            <div class="card-main">
              <div class="card-title">
                <Icon icon="mdi:bullhorn" class="title-icon" />
                <span>{{ item.name }}</span>
              </div>
              <div class="card-meta">
                <span class="meta-item">
                  <Icon icon="mdi:identifier" />
                  {{ item.key }}
                </span>
                <span class="meta-item subscribers">
                  <Icon icon="mdi:account-group" />
                  {{ item.subscriberCount || 0 }} 订阅者
                </span>
              </div>
            </div>
            <div class="card-actions">
              <t-button theme="default" variant="text" @click="navigateTo(`/topics/${item.id}`)">
                <Icon icon="mdi:eye" />
                详情
              </t-button>
              <t-button theme="danger" variant="text" @click="handleDelete(item)">
                <Icon icon="mdi:delete" />
                删除
              </t-button>
            </div>
          </div>
        </t-card>
      </div>
    </t-loading>

    <!-- Create Dialog -->
    <t-dialog
      v-model:visible="showCreateDialog"
      header="新建 Topic"
      :confirm-btn="{ content: '创建', loading: creating }"
      @confirm="handleCreate"
    >
      <t-form>
        <t-form-item label="名称" name="name">
          <t-input v-model="createForm.name" placeholder="请输入 Topic 名称" />
        </t-form-item>
        <t-form-item>
          <p class="form-tip">
            <Icon icon="mdi:information-outline" />
            创建后可通过扫码让用户订阅，支持群发消息
          </p>
        </t-form-item>
      </t-form>
    </t-dialog>
  </div>
</template>

<style scoped>
.topics-page {
  padding: 24px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.page-header h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: var(--td-text-color-secondary);
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.topic-list {
  display: grid;
  gap: 16px;
}

.topic-card {
  transition: all 0.2s;
}

.card-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-main {
  flex: 1;
}

.card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 8px;
}

.title-icon {
  color: var(--td-warning-color);
}

.card-meta {
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: var(--td-text-color-secondary);
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.meta-item.subscribers {
  color: var(--td-brand-color);
}

.card-actions {
  display: flex;
  gap: 8px;
}

.form-tip {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--td-text-color-secondary);
  margin: 0;
}

@media (max-width: 768px) {
  .card-content {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .card-actions {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>
