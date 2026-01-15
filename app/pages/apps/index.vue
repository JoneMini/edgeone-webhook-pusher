<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { MessagePlugin, DialogPlugin } from 'tdesign-vue-next';

definePageMeta({
  layout: 'default',
});

const api = useApi();

// State
const loading = ref(true);
const apps = ref<any[]>([]);
const channels = ref<any[]>([]);
const showCreateDialog = ref(false);
const createForm = ref({
  name: '',
  channelId: '',
  pushMode: 'single',
  messageType: 'normal',
  templateId: '',
});
const creating = ref(false);

// Fetch apps and channels
async function fetchData() {
  loading.value = true;
  try {
    const [appsRes, channelsRes] = await Promise.all([
      api.getApps(),
      api.getChannels(),
    ]);
    apps.value = appsRes.data || [];
    channels.value = channelsRes.data || [];
  } catch (e: any) {
    MessagePlugin.error(e.message || '获取数据失败');
  } finally {
    loading.value = false;
  }
}

// Get channel name by id
function getChannelName(channelId: string) {
  const channel = channels.value.find(c => c.id === channelId);
  return channel?.name || channelId;
}

// Create app
async function handleCreate() {
  if (!createForm.value.name.trim()) {
    MessagePlugin.warning('请输入应用名称');
    return;
  }
  if (!createForm.value.channelId) {
    MessagePlugin.warning('请选择渠道');
    return;
  }
  if (createForm.value.messageType === 'template' && !createForm.value.templateId.trim()) {
    MessagePlugin.warning('模板消息需要填写模板 ID');
    return;
  }
  creating.value = true;
  try {
    const data: any = {
      name: createForm.value.name.trim(),
      channelId: createForm.value.channelId,
      pushMode: createForm.value.pushMode,
      messageType: createForm.value.messageType,
    };
    if (createForm.value.messageType === 'template') {
      data.templateId = createForm.value.templateId.trim();
    }
    await api.createApp(data);
    MessagePlugin.success('创建成功');
    showCreateDialog.value = false;
    resetCreateForm();
    await fetchData();
  } catch (e: any) {
    MessagePlugin.error(e.message || '创建失败');
  } finally {
    creating.value = false;
  }
}

function resetCreateForm() {
  createForm.value = {
    name: '',
    channelId: '',
    pushMode: 'single',
    messageType: 'normal',
    templateId: '',
  };
}

// Delete app
async function handleDelete(item: any) {
  const dialog = DialogPlugin.confirm({
    header: '确认删除',
    body: `确定要删除应用 "${item.name}" 吗？此操作将同时删除所有绑定的 OpenID。`,
    confirmBtn: { content: '删除', theme: 'danger' },
    onConfirm: async () => {
      try {
        await api.deleteApp(item.id);
        MessagePlugin.success('删除成功');
        await fetchData();
      } catch (e: any) {
        MessagePlugin.error(e.message || '删除失败');
      }
      dialog.destroy();
    },
  });
}

// Get push mode label
function getPushModeLabel(mode: string) {
  return mode === 'single' ? '单播' : '订阅';
}

// Get message type label
function getMessageTypeLabel(type: string) {
  return type === 'template' ? '模板消息' : '普通消息';
}

onMounted(() => {
  fetchData();
});
</script>

<template>
  <div class="apps-page">
    <div class="page-header">
      <h1>应用管理</h1>
      <t-button theme="primary" @click="showCreateDialog = true">
        <template #icon><Icon icon="mdi:plus" /></template>
        新建应用
      </t-button>
    </div>

    <t-loading :loading="loading">
      <div v-if="apps.length === 0 && !loading" class="empty-state">
        <Icon icon="mdi:application-outline" class="empty-icon" />
        <p>暂无应用</p>
        <p v-if="channels.length === 0" class="empty-hint">请先创建渠道</p>
        <t-button v-else theme="primary" @click="showCreateDialog = true">创建第一个应用</t-button>
      </div>

      <div v-else class="app-list">
        <t-card v-for="item in apps" :key="item.id" class="app-card" hover-shadow>
          <div class="card-content">
            <div class="card-main">
              <div class="card-title">
                <Icon icon="mdi:application" class="title-icon" />
                <span>{{ item.name }}</span>
              </div>
              <div class="card-meta">
                <span class="meta-item">
                  <Icon icon="mdi:key" />
                  {{ item.key }}
                </span>
                <span class="meta-item channel">
                  <Icon icon="mdi:broadcast" />
                  {{ getChannelName(item.channelId) }}
                </span>
              </div>
              <div class="card-tags">
                <t-tag theme="primary" variant="light" size="small">
                  {{ getPushModeLabel(item.pushMode) }}
                </t-tag>
                <t-tag theme="warning" variant="light" size="small">
                  {{ getMessageTypeLabel(item.messageType) }}
                </t-tag>
              </div>
            </div>
            <div class="card-actions">
              <t-button theme="default" variant="text" @click="navigateTo(`/apps/${item.id}`)">
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
      header="新建应用"
      :confirm-btn="{ content: '创建', loading: creating }"
      @confirm="handleCreate"
      @close="resetCreateForm"
    >
      <t-form>
        <t-form-item label="应用名称" name="name">
          <t-input v-model="createForm.name" placeholder="请输入应用名称" />
        </t-form-item>
        <t-form-item label="关联渠道" name="channelId">
          <t-select v-model="createForm.channelId" placeholder="请选择渠道">
            <t-option 
              v-for="ch in channels" 
              :key="ch.id" 
              :value="ch.id" 
              :label="ch.name" 
            />
          </t-select>
        </t-form-item>
        <t-form-item label="推送模式" name="pushMode">
          <t-radio-group v-model="createForm.pushMode">
            <t-radio value="single">单播（发送给第一个绑定用户）</t-radio>
            <t-radio value="subscribe">订阅（发送给所有绑定用户）</t-radio>
          </t-radio-group>
        </t-form-item>
        <t-form-item label="消息类型" name="messageType">
          <t-radio-group v-model="createForm.messageType">
            <t-radio value="normal">普通消息</t-radio>
            <t-radio value="template">模板消息</t-radio>
          </t-radio-group>
        </t-form-item>
        <t-form-item v-if="createForm.messageType === 'template'" label="模板 ID" name="templateId">
          <t-input v-model="createForm.templateId" placeholder="微信模板消息 ID" />
        </t-form-item>
        <t-form-item>
          <p class="form-tip">
            <Icon icon="mdi:information-outline" />
            创建后可通过 Webhook URL 发送消息
          </p>
        </t-form-item>
      </t-form>
    </t-dialog>
  </div>
</template>

<style scoped>
.apps-page {
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

.empty-hint {
  font-size: 13px;
  margin-top: 8px;
}

.app-list {
  display: grid;
  gap: 16px;
}

.app-card {
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
  color: var(--td-brand-color);
}

.card-meta {
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: var(--td-text-color-secondary);
  margin-bottom: 8px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.meta-item.channel {
  color: #07c160;
}

.card-tags {
  display: flex;
  gap: 8px;
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
