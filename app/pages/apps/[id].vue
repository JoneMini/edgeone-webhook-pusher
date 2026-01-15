<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { MessagePlugin, DialogPlugin } from 'tdesign-vue-next';

definePageMeta({
  layout: 'default',
});

const route = useRoute();
const router = useRouter();
const api = useApi();

const id = computed(() => route.params.id as string);

// State
const loading = ref(true);
const app = ref<any>(null);
const channel = ref<any>(null);
const openIds = ref<any[]>([]);
const showEditDialog = ref(false);
const showAddOpenIdDialog = ref(false);
const editForm = ref({ name: '', templateId: '' });
const addOpenIdForm = ref({ openId: '', nickname: '', remark: '' });
const saving = ref(false);
const addingOpenId = ref(false);

// Fetch app detail
async function fetchApp() {
  loading.value = true;
  try {
    const res = await api.getApp(id.value);
    app.value = res.data;
    editForm.value = {
      name: app.value.name,
      templateId: app.value.templateId || '',
    };
    // Fetch channel info
    if (app.value.channelId) {
      const channelRes = await api.getChannel(app.value.channelId);
      channel.value = channelRes.data;
    }
    // Fetch openIds
    await fetchOpenIds();
  } catch (e: any) {
    MessagePlugin.error(e.message || '获取应用详情失败');
    router.push('/apps');
  } finally {
    loading.value = false;
  }
}

// Fetch openIds for this app
async function fetchOpenIds() {
  try {
    const res = await api.getAppOpenIds(id.value);
    openIds.value = res.data || [];
  } catch (e: any) {
    console.error('Failed to fetch openIds:', e);
  }
}

// Get webhook URL
function getWebhookUrl() {
  if (!app.value) return '';
  const origin = window.location.origin;
  return `${origin}/${app.value.key}.send`;
}

// Copy to clipboard
async function copyToClipboard(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    MessagePlugin.success(`${label}已复制`);
  } catch (e) {
    MessagePlugin.error('复制失败');
  }
}

// Update app
async function handleUpdate() {
  if (!editForm.value.name.trim()) {
    MessagePlugin.warning('请输入应用名称');
    return;
  }
  if (app.value.messageType === 'template' && !editForm.value.templateId.trim()) {
    MessagePlugin.warning('模板消息需要填写模板 ID');
    return;
  }
  saving.value = true;
  try {
    const updateData: any = { name: editForm.value.name.trim() };
    if (app.value.messageType === 'template') {
      updateData.templateId = editForm.value.templateId.trim();
    }
    await api.updateApp(id.value, updateData);
    MessagePlugin.success('更新成功');
    showEditDialog.value = false;
    await fetchApp();
  } catch (e: any) {
    MessagePlugin.error(e.message || '更新失败');
  } finally {
    saving.value = false;
  }
}

// Delete app
async function handleDelete() {
  const dialog = DialogPlugin.confirm({
    header: '确认删除',
    body: `确定要删除应用 "${app.value?.name}" 吗？此操作将同时删除所有绑定的 OpenID。`,
    confirmBtn: { content: '删除', theme: 'danger' },
    onConfirm: async () => {
      try {
        await api.deleteApp(id.value);
        MessagePlugin.success('删除成功');
        router.push('/apps');
      } catch (e: any) {
        MessagePlugin.error(e.message || '删除失败');
      }
      dialog.destroy();
    },
  });
}

// Add OpenID
async function handleAddOpenId() {
  if (!addOpenIdForm.value.openId.trim()) {
    MessagePlugin.warning('请输入 OpenID');
    return;
  }
  addingOpenId.value = true;
  try {
    await api.createAppOpenId(id.value, {
      openId: addOpenIdForm.value.openId.trim(),
      nickname: addOpenIdForm.value.nickname.trim() || undefined,
      remark: addOpenIdForm.value.remark.trim() || undefined,
    });
    MessagePlugin.success('添加成功');
    showAddOpenIdDialog.value = false;
    addOpenIdForm.value = { openId: '', nickname: '', remark: '' };
    await fetchOpenIds();
  } catch (e: any) {
    MessagePlugin.error(e.message || '添加失败');
  } finally {
    addingOpenId.value = false;
  }
}

// Delete OpenID
async function handleDeleteOpenId(item: any) {
  const dialog = DialogPlugin.confirm({
    header: '确认删除',
    body: `确定要删除 OpenID "${item.nickname || item.openId}" 吗？`,
    confirmBtn: { content: '删除', theme: 'danger' },
    onConfirm: async () => {
      try {
        await api.deleteAppOpenId(id.value, item.id);
        MessagePlugin.success('删除成功');
        await fetchOpenIds();
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
  fetchApp();
});
</script>

<template>
  <div class="app-detail">
    <div class="page-header">
      <t-button theme="default" variant="text" @click="router.push('/apps')">
        <Icon icon="mdi:arrow-left" />
        返回列表
      </t-button>
    </div>

    <t-loading :loading="loading">
      <div v-if="app" class="detail-content">
        <!-- Basic Info -->
        <t-card title="基本信息" class="info-card">
          <template #actions>
            <t-button theme="default" variant="text" @click="showEditDialog = true">
              <Icon icon="mdi:pencil" />
              编辑
            </t-button>
            <t-button theme="danger" variant="text" @click="handleDelete">
              <Icon icon="mdi:delete" />
              删除
            </t-button>
          </template>

          <t-descriptions :column="1">
            <t-descriptions-item label="应用名称">{{ app.name }}</t-descriptions-item>
            <t-descriptions-item label="App Key">
              <div class="copy-field">
                <code>{{ app.key }}</code>
                <t-button size="small" variant="text" @click="copyToClipboard(app.key, 'App Key')">
                  <Icon icon="mdi:content-copy" />
                </t-button>
              </div>
            </t-descriptions-item>
            <t-descriptions-item label="关联渠道">
              <t-tag v-if="channel" theme="success" variant="light">
                <Icon icon="mdi:wechat" style="margin-right: 4px;" />
                {{ channel.name }}
              </t-tag>
              <span v-else>{{ app.channelId }}</span>
            </t-descriptions-item>
            <t-descriptions-item label="推送模式">
              <t-tag theme="primary" variant="light">{{ getPushModeLabel(app.pushMode) }}</t-tag>
            </t-descriptions-item>
            <t-descriptions-item label="消息类型">
              <t-tag theme="warning" variant="light">{{ getMessageTypeLabel(app.messageType) }}</t-tag>
            </t-descriptions-item>
            <t-descriptions-item v-if="app.messageType === 'template'" label="模板 ID">
              <code>{{ app.templateId || '-' }}</code>
            </t-descriptions-item>
            <t-descriptions-item label="创建时间">{{ app.createdAt }}</t-descriptions-item>
          </t-descriptions>
        </t-card>

        <!-- OpenID Management -->
        <t-card title="绑定用户" class="openid-card">
          <template #actions>
            <t-button theme="primary" variant="text" @click="showAddOpenIdDialog = true">
              <Icon icon="mdi:plus" />
              添加 OpenID
            </t-button>
          </template>

          <div v-if="openIds.length === 0" class="empty-openids">
            <Icon icon="mdi:account-off" class="empty-icon" />
            <p>暂无绑定用户</p>
            <t-button theme="primary" size="small" @click="showAddOpenIdDialog = true">
              添加第一个 OpenID
            </t-button>
          </div>

          <div v-else class="openid-list">
            <div v-for="item in openIds" :key="item.id" class="openid-item">
              <div class="openid-info">
                <Icon icon="mdi:account" class="openid-icon" />
                <div class="openid-detail">
                  <span class="openid-name">{{ item.nickname || item.openId }}</span>
                  <span v-if="item.nickname" class="openid-value">{{ item.openId }}</span>
                  <span v-if="item.remark" class="openid-remark">{{ item.remark }}</span>
                </div>
              </div>
              <t-button theme="danger" variant="text" size="small" @click="handleDeleteOpenId(item)">
                <Icon icon="mdi:delete" />
              </t-button>
            </div>
          </div>
        </t-card>

        <!-- Webhook URL -->
        <t-card title="Webhook 使用" class="webhook-card">
          <div class="webhook-section">
            <div class="webhook-url">
              <label>Webhook URL:</label>
              <div class="copy-field">
                <code>{{ getWebhookUrl() }}</code>
                <t-button size="small" variant="text" @click="copyToClipboard(getWebhookUrl(), 'Webhook URL')">
                  <Icon icon="mdi:content-copy" />
                </t-button>
              </div>
            </div>

            <div class="usage-example">
              <h4>使用示例</h4>
              <t-tabs default-value="curl">
                <t-tab-panel value="curl" label="cURL">
                  <pre><code>curl "{{ getWebhookUrl() }}?title=测试消息&amp;desp=这是消息内容"</code></pre>
                </t-tab-panel>
                <t-tab-panel value="post" label="POST">
                  <pre><code>curl -X POST "{{ getWebhookUrl() }}" \
  -H "Content-Type: application/json" \
  -d '{"title":"测试消息","desp":"这是消息内容"}'</code></pre>
                </t-tab-panel>
                <t-tab-panel value="browser" label="浏览器">
                  <p class="browser-tip">直接在浏览器地址栏访问：</p>
                  <pre><code>{{ getWebhookUrl() }}?title=测试消息&amp;desp=这是消息内容</code></pre>
                </t-tab-panel>
              </t-tabs>
            </div>
          </div>
        </t-card>
      </div>
    </t-loading>

    <!-- Edit Dialog -->
    <t-dialog
      v-model:visible="showEditDialog"
      header="编辑应用"
      :confirm-btn="{ content: '保存', loading: saving }"
      @confirm="handleUpdate"
    >
      <t-form>
        <t-form-item label="应用名称" name="name">
          <t-input v-model="editForm.name" placeholder="请输入应用名称" />
        </t-form-item>
        <t-form-item v-if="app?.messageType === 'template'" label="模板 ID" name="templateId">
          <t-input v-model="editForm.templateId" placeholder="微信模板消息 ID" />
        </t-form-item>
      </t-form>
    </t-dialog>

    <!-- Add OpenID Dialog -->
    <t-dialog
      v-model:visible="showAddOpenIdDialog"
      header="添加 OpenID"
      :confirm-btn="{ content: '添加', loading: addingOpenId }"
      @confirm="handleAddOpenId"
    >
      <t-form>
        <t-form-item label="OpenID" name="openId">
          <t-input v-model="addOpenIdForm.openId" placeholder="微信用户 OpenID" />
        </t-form-item>
        <t-form-item label="昵称" name="nickname">
          <t-input v-model="addOpenIdForm.nickname" placeholder="可选，便于识别" />
        </t-form-item>
        <t-form-item label="备注" name="remark">
          <t-input v-model="addOpenIdForm.remark" placeholder="可选" />
        </t-form-item>
      </t-form>
    </t-dialog>
  </div>
</template>

<style scoped>
.app-detail {
  padding: 24px;
}

.page-header {
  margin-bottom: 24px;
}

.detail-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.copy-field {
  display: flex;
  align-items: center;
  gap: 8px;
}

.copy-field code {
  background: var(--td-bg-color-secondarycontainer);
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 13px;
}

.empty-openids {
  text-align: center;
  padding: 32px 20px;
  color: var(--td-text-color-secondary);
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 12px;
  opacity: 0.5;
}

.openid-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.openid-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--td-bg-color-secondarycontainer);
  border-radius: 8px;
}

.openid-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.openid-icon {
  font-size: 24px;
  color: var(--td-brand-color);
}

.openid-detail {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.openid-name {
  font-weight: 500;
}

.openid-value {
  font-size: 12px;
  color: var(--td-text-color-secondary);
  font-family: monospace;
}

.openid-remark {
  font-size: 12px;
  color: var(--td-text-color-placeholder);
}

.webhook-url {
  margin-bottom: 24px;
}

.webhook-url label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
}

.usage-example h4 {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 500;
}

.usage-example pre {
  background: var(--td-bg-color-secondarycontainer);
  padding: 16px;
  border-radius: 8px;
  overflow-x: auto;
  margin: 0;
}

.usage-example code {
  font-size: 13px;
  line-height: 1.5;
}

.browser-tip {
  margin: 0 0 8px;
  font-size: 13px;
  color: var(--td-text-color-secondary);
}
</style>
