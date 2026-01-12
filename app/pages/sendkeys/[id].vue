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
const sendKey = ref<any>(null);
const qrCodeUrl = ref('');
const showEditDialog = ref(false);
const editForm = ref({ name: '' });
const saving = ref(false);

// Fetch sendkey detail
async function fetchSendKey() {
  loading.value = true;
  try {
    const res = await api.getSendKey(id.value);
    sendKey.value = res.data;
    editForm.value.name = sendKey.value.name;
    await generateQRCode();
  } catch (e: any) {
    MessagePlugin.error(e.message || '获取 SendKey 详情失败');
    router.push('/sendkeys');
  } finally {
    loading.value = false;
  }
}

// Generate QR code for binding
async function generateQRCode() {
  if (!sendKey.value) return;
  const bindUrl = getBindUrl();
  try {
    qrCodeUrl.value = await QRCode.toDataURL(bindUrl, {
      width: 200,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    });
  } catch (e) {
    console.error('QR code generation failed:', e);
  }
}

// Get bind URL
function getBindUrl() {
  const origin = window.location.origin;
  return `${origin}/bind/${sendKey.value.id}`;
}

// Get webhook URL
function getWebhookUrl() {
  if (!sendKey.value) return '';
  const origin = window.location.origin;
  return `${origin}/${sendKey.value.key}.send`;
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

// Update sendkey
async function handleUpdate() {
  if (!editForm.value.name.trim()) {
    MessagePlugin.warning('请输入名称');
    return;
  }
  saving.value = true;
  try {
    await api.updateSendKey(id.value, { name: editForm.value.name.trim() });
    MessagePlugin.success('更新成功');
    showEditDialog.value = false;
    await fetchSendKey();
  } catch (e: any) {
    MessagePlugin.error(e.message || '更新失败');
  } finally {
    saving.value = false;
  }
}

// Delete sendkey
async function handleDelete() {
  const dialog = DialogPlugin.confirm({
    header: '确认删除',
    body: `确定要删除 SendKey "${sendKey.value?.name}" 吗？此操作不可恢复。`,
    confirmBtn: { content: '删除', theme: 'danger' },
    onConfirm: async () => {
      try {
        await api.deleteSendKey(id.value);
        MessagePlugin.success('删除成功');
        router.push('/sendkeys');
      } catch (e: any) {
        MessagePlugin.error(e.message || '删除失败');
      }
      dialog.destroy();
    },
  });
}

// Unbind openid
async function handleUnbind() {
  const dialog = DialogPlugin.confirm({
    header: '确认解绑',
    body: '确定要解除当前绑定的用户吗？解绑后需要重新扫码绑定。',
    onConfirm: async () => {
      try {
        await api.updateSendKey(id.value, { openIdRef: null });
        MessagePlugin.success('解绑成功');
        await fetchSendKey();
      } catch (e: any) {
        MessagePlugin.error(e.message || '解绑失败');
      }
      dialog.destroy();
    },
  });
}

onMounted(() => {
  fetchSendKey();
});
</script>

<template>
  <div class="sendkey-detail">
    <div class="page-header">
      <t-button theme="default" variant="text" @click="router.push('/sendkeys')">
        <Icon icon="mdi:arrow-left" />
        返回列表
      </t-button>
    </div>

    <t-loading :loading="loading">
      <div v-if="sendKey" class="detail-content">
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
            <t-descriptions-item label="名称">{{ sendKey.name }}</t-descriptions-item>
            <t-descriptions-item label="Key">
              <div class="copy-field">
                <code>{{ sendKey.key }}</code>
                <t-button size="small" variant="text" @click="copyToClipboard(sendKey.key, 'Key')">
                  <Icon icon="mdi:content-copy" />
                </t-button>
              </div>
            </t-descriptions-item>
            <t-descriptions-item label="创建时间">{{ sendKey.createdAt }}</t-descriptions-item>
            <t-descriptions-item label="更新时间">{{ sendKey.updatedAt }}</t-descriptions-item>
          </t-descriptions>
        </t-card>

        <!-- Binding Status -->
        <t-card title="绑定状态" class="binding-card">
          <div v-if="sendKey.openIdRef" class="bound-info">
            <div class="bound-status">
              <Icon icon="mdi:account-check" class="status-icon success" />
              <span>已绑定用户</span>
            </div>
            <div class="bound-detail">
              <p><strong>OpenID:</strong> {{ sendKey.openId?.openId || sendKey.openIdRef }}</p>
              <p v-if="sendKey.openId?.name"><strong>昵称:</strong> {{ sendKey.openId.name }}</p>
            </div>
            <t-button theme="default" @click="handleUnbind">
              <Icon icon="mdi:link-off" />
              解除绑定
            </t-button>
          </div>

          <div v-else class="unbound-info">
            <div class="qr-section">
              <div class="qr-code">
                <img v-if="qrCodeUrl" :src="qrCodeUrl" alt="绑定二维码" />
                <div v-else class="qr-placeholder">
                  <Icon icon="mdi:qrcode" />
                </div>
              </div>
              <div class="qr-tips">
                <h4>扫码绑定</h4>
                <p>使用微信扫描二维码，完成用户绑定</p>
                <div class="bind-url">
                  <span>绑定链接:</span>
                  <code>{{ getBindUrl() }}</code>
                  <t-button size="small" variant="text" @click="copyToClipboard(getBindUrl(), '绑定链接')">
                    <Icon icon="mdi:content-copy" />
                  </t-button>
                </div>
              </div>
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
  -d '{"title": "测试消息", "content": "这是消息内容"}'</code></pre>
                </t-tab-panel>
                <t-tab-panel value="js" label="JavaScript">
                  <pre><code>fetch("{{ getWebhookUrl() }}", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    title: "测试消息",
    content: "这是消息内容"
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
      header="编辑 SendKey"
      :confirm-btn="{ content: '保存', loading: saving }"
      @confirm="handleUpdate"
    >
      <t-form>
        <t-form-item label="名称" name="name">
          <t-input v-model="editForm.name" placeholder="请输入 SendKey 名称" />
        </t-form-item>
      </t-form>
    </t-dialog>
  </div>
</template>

<style scoped>
.sendkey-detail {
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

.bound-info {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.bound-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 500;
}

.status-icon.success {
  color: var(--td-success-color);
  font-size: 24px;
}

.bound-detail {
  background: var(--td-bg-color-secondarycontainer);
  padding: 12px 16px;
  border-radius: 8px;
}

.bound-detail p {
  margin: 4px 0;
  font-size: 14px;
}

.unbound-info .qr-section {
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

.bind-url {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.bind-url code {
  background: var(--td-bg-color-secondarycontainer);
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  word-break: break-all;
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
  .unbound-info .qr-section {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
}
</style>
