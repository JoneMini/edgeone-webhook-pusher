<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { MessagePlugin, DialogPlugin } from 'tdesign-vue-next';
import QRCode from 'qrcode';

definePageMeta({
  layout: 'default',
});

const route = useRoute();
const router = useRouter();
const api = useApi();

const id = computed(() => route.params.id as string);

// State
const loading = ref(true);
const topic = ref<any>(null);
const qrCodeUrl = ref('');
const showEditDialog = ref(false);
const editForm = ref({ name: '' });
const saving = ref(false);

// Fetch topic detail
async function fetchTopic() {
  loading.value = true;
  try {
    const res = await api.getTopic(id.value);
    topic.value = res.data;
    editForm.value.name = topic.value.name;
    await generateQRCode();
  } catch (e: any) {
    MessagePlugin.error(e.message || '获取 Topic 详情失败');
    router.push('/topics');
  } finally {
    loading.value = false;
  }
}

// Generate QR code for subscription
async function generateQRCode() {
  if (!topic.value) return;
  const subscribeUrl = getSubscribeUrl();
  try {
    qrCodeUrl.value = await QRCode.toDataURL(subscribeUrl, {
      width: 200,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    });
  } catch (e) {
    console.error('QR code generation failed:', e);
  }
}

// Get subscribe URL
function getSubscribeUrl() {
  const origin = window.location.origin;
  return `${origin}/subscribe/${topic.value.id}`;
}

// Get webhook URL
function getWebhookUrl() {
  if (!topic.value) return '';
  const origin = window.location.origin;
  return `${origin}/${topic.value.key}.topic`;
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

// Update topic
async function handleUpdate() {
  if (!editForm.value.name.trim()) {
    MessagePlugin.warning('请输入名称');
    return;
  }
  saving.value = true;
  try {
    await api.updateTopic(id.value, { name: editForm.value.name.trim() });
    MessagePlugin.success('更新成功');
    showEditDialog.value = false;
    await fetchTopic();
  } catch (e: any) {
    MessagePlugin.error(e.message || '更新失败');
  } finally {
    saving.value = false;
  }
}

// Delete topic
async function handleDelete() {
  const dialog = DialogPlugin.confirm({
    header: '确认删除',
    body: `确定要删除 Topic "${topic.value?.name}" 吗？此操作不可恢复。`,
    confirmBtn: { content: '删除', theme: 'danger' },
    onConfirm: async () => {
      try {
        await api.deleteTopic(id.value);
        MessagePlugin.success('删除成功');
        router.push('/topics');
      } catch (e: any) {
        MessagePlugin.error(e.message || '删除失败');
      }
      dialog.destroy();
    },
  });
}

// Unsubscribe user
async function handleUnsubscribe(subscriber: any) {
  const dialog = DialogPlugin.confirm({
    header: '确认取消订阅',
    body: `确定要移除订阅者 "${subscriber.name || subscriber.openId}" 吗？`,
    onConfirm: async () => {
      try {
        await api.unsubscribeTopic(id.value, subscriber.id);
        MessagePlugin.success('已移除订阅者');
        await fetchTopic();
      } catch (e: any) {
        MessagePlugin.error(e.message || '操作失败');
      }
      dialog.destroy();
    },
  });
}

onMounted(() => {
  fetchTopic();
});
</script>

<template>
  <div class="topic-detail">
    <div class="page-header">
      <t-button theme="default" variant="text" @click="router.push('/topics')">
        <Icon icon="mdi:arrow-left" />
        返回列表
      </t-button>
    </div>

    <t-loading :loading="loading">
      <div v-if="topic" class="detail-content">
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
            <t-descriptions-item label="名称">{{ topic.name }}</t-descriptions-item>
            <t-descriptions-item label="Key">
              <div class="copy-field">
                <code>{{ topic.key }}</code>
                <t-button size="small" variant="text" @click="copyToClipboard(topic.key, 'Key')">
                  <Icon icon="mdi:content-copy" />
                </t-button>
              </div>
            </t-descriptions-item>
            <t-descriptions-item label="订阅者数量">
              <t-tag theme="primary">{{ topic.subscriberCount || 0 }}</t-tag>
            </t-descriptions-item>
            <t-descriptions-item label="创建时间">{{ topic.createdAt }}</t-descriptions-item>
            <t-descriptions-item label="更新时间">{{ topic.updatedAt }}</t-descriptions-item>
          </t-descriptions>
        </t-card>

        <!-- Subscribe QR Code -->
        <t-card title="订阅二维码" class="qr-card">
          <div class="qr-section">
            <div class="qr-code">
              <img v-if="qrCodeUrl" :src="qrCodeUrl" alt="订阅二维码" />
              <div v-else class="qr-placeholder">
                <Icon icon="mdi:qrcode" />
              </div>
            </div>
            <div class="qr-tips">
              <h4>扫码订阅</h4>
              <p>使用微信扫描二维码，订阅此 Topic 的消息推送</p>
              <div class="subscribe-url">
                <span>订阅链接:</span>
                <code>{{ getSubscribeUrl() }}</code>
                <t-button size="small" variant="text" @click="copyToClipboard(getSubscribeUrl(), '订阅链接')">
                  <Icon icon="mdi:content-copy" />
                </t-button>
              </div>
            </div>
          </div>
        </t-card>

        <!-- Subscribers List -->
        <t-card title="订阅者列表" class="subscribers-card">
          <div v-if="!topic.subscribers?.length" class="empty-subscribers">
            <Icon icon="mdi:account-group-outline" class="empty-icon" />
            <p>暂无订阅者</p>
            <p class="tip">分享订阅二维码让用户扫码订阅</p>
          </div>

          <div v-else class="subscriber-list">
            <div v-for="sub in topic.subscribers" :key="sub.id" class="subscriber-item">
              <div class="subscriber-info">
                <Icon icon="mdi:account" class="subscriber-icon" />
                <div class="subscriber-detail">
                  <span class="subscriber-name">{{ sub.name || '未知用户' }}</span>
                  <span class="subscriber-openid">{{ sub.openId }}</span>
                </div>
              </div>
              <t-button theme="danger" variant="text" size="small" @click="handleUnsubscribe(sub)">
                <Icon icon="mdi:close" />
                移除
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
                  <pre><code>curl -X POST "{{ getWebhookUrl() }}" \
  -H "Content-Type: application/json" \
  -d '{"title": "群发消息", "content": "这是群发内容"}'</code></pre>
                </t-tab-panel>
                <t-tab-panel value="js" label="JavaScript">
                  <pre><code>fetch("{{ getWebhookUrl() }}", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    title: "群发消息",
    content: "这是群发内容"
  })
});</code></pre>
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
      header="编辑 Topic"
      :confirm-btn="{ content: '保存', loading: saving }"
      @confirm="handleUpdate"
    >
      <t-form>
        <t-form-item label="名称" name="name">
          <t-input v-model="editForm.name" placeholder="请输入 Topic 名称" />
        </t-form-item>
      </t-form>
    </t-dialog>
  </div>
</template>

<style scoped>
.topic-detail {
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

.qr-section {
  display: flex;
  gap: 24px;
  align-items: flex-start;
}

.qr-code {
  flex-shrink: 0;
}

.qr-code img {
  width: 200px;
  height: 200px;
  border: 1px solid var(--td-border-level-1-color);
  border-radius: 8px;
}

.qr-placeholder {
  width: 200px;
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--td-bg-color-secondarycontainer);
  border-radius: 8px;
  font-size: 64px;
  color: var(--td-text-color-placeholder);
}

.qr-tips h4 {
  margin: 0 0 8px;
  font-size: 16px;
}

.qr-tips p {
  margin: 0 0 16px;
  color: var(--td-text-color-secondary);
}

.subscribe-url {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.subscribe-url code {
  background: var(--td-bg-color-secondarycontainer);
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  word-break: break-all;
}

.empty-subscribers {
  text-align: center;
  padding: 40px 20px;
  color: var(--td-text-color-secondary);
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 12px;
  opacity: 0.5;
}

.empty-subscribers .tip {
  font-size: 13px;
  margin-top: 8px;
}

.subscriber-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.subscriber-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--td-bg-color-secondarycontainer);
  border-radius: 8px;
}

.subscriber-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.subscriber-icon {
  font-size: 24px;
  color: var(--td-brand-color);
}

.subscriber-detail {
  display: flex;
  flex-direction: column;
}

.subscriber-name {
  font-weight: 500;
}

.subscriber-openid {
  font-size: 12px;
  color: var(--td-text-color-secondary);
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

@media (max-width: 768px) {
  .qr-section {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
}
</style>
