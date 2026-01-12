<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { MessagePlugin, DialogPlugin } from 'tdesign-vue-next';

definePageMeta({
  layout: 'default',
});

const api = useApi();

// State
const loading = ref(true);
const sendKeys = ref<any[]>([]);
const showCreateDialog = ref(false);
const createForm = ref({ name: '' });
const creating = ref(false);

// Fetch sendkeys
async function fetchSendKeys() {
  loading.value = true;
  try {
    const res = await api.getSendKeys();
    sendKeys.value = res.data || [];
  } catch (e: any) {
    MessagePlugin.error(e.message || '获取 SendKey 列表失败');
  } finally {
    loading.value = false;
  }
}

// Create sendkey
async function handleCreate() {
  if (!createForm.value.name.trim()) {
    MessagePlugin.warning('请输入名称');
    return;
  }
  creating.value = true;
  try {
    await api.createSendKey({ name: createForm.value.name.trim() });
    MessagePlugin.success('创建成功');
    showCreateDialog.value = false;
    createForm.value.name = '';
    await fetchSendKeys();
  } catch (e: any) {
    MessagePlugin.error(e.message || '创建失败');
  } finally {
    creating.value = false;
  }
}

// Delete sendkey
async function handleDelete(item: any) {
  const dialog = DialogPlugin.confirm({
    header: '确认删除',
    body: `确定要删除 SendKey "${item.name}" 吗？此操作不可恢复。`,
    confirmBtn: { content: '删除', theme: 'danger' },
    onConfirm: async () => {
      try {
        await api.deleteSendKey(item.id);
        MessagePlugin.success('删除成功');
        await fetchSendKeys();
      } catch (e: any) {
        MessagePlugin.error(e.message || '删除失败');
      }
      dialog.destroy();
    },
  });
}

// Generate webhook URL
function getWebhookUrl(key: string) {
  const origin = window.location.origin;
  return `${origin}/${key}.send`;
}

onMounted(() => {
  fetchSendKeys();
});
</script>

<template>
  <div class="sendkeys-page">
    <div class="page-header">
      <h1>SendKey 管理</h1>
      <t-button theme="primary" @click="showCreateDialog = true">
        <template #icon><Icon icon="mdi:plus" /></template>
        新建 SendKey
      </t-button>
    </div>

    <t-loading :loading="loading">
      <div v-if="sendKeys.length === 0 && !loading" class="empty-state">
        <Icon icon="mdi:key-outline" class="empty-icon" />
        <p>暂无 SendKey</p>
        <t-button theme="primary" @click="showCreateDialog = true">创建第一个 SendKey</t-button>
      </div>

      <div v-else class="sendkey-list">
        <t-card v-for="item in sendKeys" :key="item.id" class="sendkey-card" hover-shadow>
          <div class="card-content">
            <div class="card-main">
              <div class="card-title">
                <Icon icon="mdi:key" class="title-icon" />
                <span>{{ item.name }}</span>
              </div>
              <div class="card-meta">
                <span class="meta-item">
                  <Icon icon="mdi:identifier" />
                  {{ item.key }}
                </span>
                <span class="meta-item" :class="{ bound: item.openIdRef }">
                  <Icon :icon="item.openIdRef ? 'mdi:account-check' : 'mdi:account-off'" />
                  {{ item.openIdRef ? '已绑定' : '未绑定' }}
                </span>
              </div>
            </div>
            <div class="card-actions">
              <t-button theme="default" variant="text" @click="navigateTo(`/sendkeys/${item.id}`)">
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
      header="新建 SendKey"
      :confirm-btn="{ content: '创建', loading: creating }"
      @confirm="handleCreate"
    >
      <t-form>
        <t-form-item label="名称" name="name">
          <t-input v-model="createForm.name" placeholder="请输入 SendKey 名称" />
        </t-form-item>
        <t-form-item>
          <p class="form-tip">
            <Icon icon="mdi:information-outline" />
            创建后可通过扫码绑定微信用户，或手动绑定 OpenID
          </p>
        </t-form-item>
      </t-form>
    </t-dialog>
  </div>
</template>

<style scoped>
.sendkeys-page {
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

.sendkey-list {
  display: grid;
  gap: 16px;
}

.sendkey-card {
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
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.meta-item.bound {
  color: var(--td-success-color);
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
