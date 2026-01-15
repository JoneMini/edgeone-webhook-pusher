<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { MessagePlugin, DialogPlugin } from 'tdesign-vue-next';

definePageMeta({
  layout: 'default',
});

const api = useApi();

// State
const loading = ref(true);
const channels = ref<any[]>([]);
const showCreateDialog = ref(false);
const createForm = ref({
  name: '',
  type: 'wechat',
  appId: '',
  appSecret: '',
});
const creating = ref(false);

// Fetch channels
async function fetchChannels() {
  loading.value = true;
  try {
    const res = await api.getChannels();
    channels.value = res.data || [];
  } catch (e: any) {
    MessagePlugin.error(e.message || '获取渠道列表失败');
  } finally {
    loading.value = false;
  }
}

// Create channel
async function handleCreate() {
  if (!createForm.value.name.trim()) {
    MessagePlugin.warning('请输入渠道名称');
    return;
  }
  if (!createForm.value.appId.trim()) {
    MessagePlugin.warning('请输入 AppID');
    return;
  }
  if (!createForm.value.appSecret.trim()) {
    MessagePlugin.warning('请输入 AppSecret');
    return;
  }
  creating.value = true;
  try {
    await api.createChannel({
      name: createForm.value.name.trim(),
      type: createForm.value.type,
      config: {
        appId: createForm.value.appId.trim(),
        appSecret: createForm.value.appSecret.trim(),
      },
    });
    MessagePlugin.success('创建成功');
    showCreateDialog.value = false;
    resetCreateForm();
    await fetchChannels();
  } catch (e: any) {
    MessagePlugin.error(e.message || '创建失败');
  } finally {
    creating.value = false;
  }
}

function resetCreateForm() {
  createForm.value = {
    name: '',
    type: 'wechat',
    appId: '',
    appSecret: '',
  };
}

// Delete channel
async function handleDelete(item: any) {
  const dialog = DialogPlugin.confirm({
    header: '确认删除',
    body: `确定要删除渠道 "${item.name}" 吗？如果有应用关联此渠道，将无法删除。`,
    confirmBtn: { content: '删除', theme: 'danger' },
    onConfirm: async () => {
      try {
        await api.deleteChannel(item.id);
        MessagePlugin.success('删除成功');
        await fetchChannels();
      } catch (e: any) {
        MessagePlugin.error(e.message || '删除失败');
      }
      dialog.destroy();
    },
  });
}

onMounted(() => {
  fetchChannels();
});
</script>

<template>
  <div class="channels-page">
    <div class="page-header">
      <h1>渠道管理</h1>
      <t-button theme="primary" @click="showCreateDialog = true">
        <template #icon><Icon icon="mdi:plus" /></template>
        新建渠道
      </t-button>
    </div>

    <t-loading :loading="loading">
      <div v-if="channels.length === 0 && !loading" class="empty-state">
        <Icon icon="mdi:broadcast" class="empty-icon" />
        <p>暂无渠道</p>
        <t-button theme="primary" @click="showCreateDialog = true">创建第一个渠道</t-button>
      </div>

      <div v-else class="channel-list">
        <t-card v-for="item in channels" :key="item.id" class="channel-card" hover-shadow>
          <div class="card-content">
            <div class="card-main">
              <div class="card-title">
                <Icon icon="mdi:wechat" class="title-icon" />
                <span>{{ item.name }}</span>
              </div>
              <div class="card-meta">
                <span class="meta-item">
                  <Icon icon="mdi:identifier" />
                  {{ item.config?.appId || '-' }}
                </span>
                <span class="meta-item type-badge">
                  <Icon icon="mdi:tag" />
                  {{ item.type === 'wechat' ? '微信公众号' : item.type }}
                </span>
              </div>
            </div>
            <div class="card-actions">
              <t-button theme="default" variant="text" @click="navigateTo(`/channels/${item.id}`)">
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
      header="新建渠道"
      :confirm-btn="{ content: '创建', loading: creating }"
      @confirm="handleCreate"
      @close="resetCreateForm"
    >
      <t-form>
        <t-form-item label="渠道名称" name="name">
          <t-input v-model="createForm.name" placeholder="请输入渠道名称" />
        </t-form-item>
        <t-form-item label="渠道类型" name="type">
          <t-select v-model="createForm.type" disabled>
            <t-option value="wechat" label="微信公众号" />
          </t-select>
        </t-form-item>
        <t-form-item label="AppID" name="appId">
          <t-input v-model="createForm.appId" placeholder="微信公众号 AppID" />
        </t-form-item>
        <t-form-item label="AppSecret" name="appSecret">
          <t-input v-model="createForm.appSecret" type="password" placeholder="微信公众号 AppSecret" />
        </t-form-item>
        <t-form-item>
          <p class="form-tip">
            <Icon icon="mdi:information-outline" />
            渠道用于配置消息发送通道，创建后可在应用中引用
          </p>
        </t-form-item>
      </t-form>
    </t-dialog>
  </div>
</template>

<style scoped>
.channels-page {
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

.channel-list {
  display: grid;
  gap: 16px;
}

.channel-card {
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
  color: #07c160;
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

.meta-item.type-badge {
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
