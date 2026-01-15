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
const channel = ref<any>(null);
const showEditDialog = ref(false);
const editForm = ref({
  name: '',
  appId: '',
  appSecret: '',
});
const saving = ref(false);

// Fetch channel detail
async function fetchChannel() {
  loading.value = true;
  try {
    const res = await api.getChannel(id.value);
    channel.value = res.data;
    editForm.value = {
      name: channel.value.name,
      appId: channel.value.config?.appId || '',
      appSecret: '', // Don't show existing secret
    };
  } catch (e: any) {
    MessagePlugin.error(e.message || '获取渠道详情失败');
    router.push('/channels');
  } finally {
    loading.value = false;
  }
}

// Update channel
async function handleUpdate() {
  if (!editForm.value.name.trim()) {
    MessagePlugin.warning('请输入渠道名称');
    return;
  }
  saving.value = true;
  try {
    const updateData: any = {
      name: editForm.value.name.trim(),
    };
    // Only update config if appId or appSecret changed
    if (editForm.value.appId.trim() || editForm.value.appSecret.trim()) {
      updateData.config = {
        appId: editForm.value.appId.trim() || channel.value.config?.appId,
        appSecret: editForm.value.appSecret.trim() || channel.value.config?.appSecret,
      };
    }
    await api.updateChannel(id.value, updateData);
    MessagePlugin.success('更新成功');
    showEditDialog.value = false;
    await fetchChannel();
  } catch (e: any) {
    MessagePlugin.error(e.message || '更新失败');
  } finally {
    saving.value = false;
  }
}

// Delete channel
async function handleDelete() {
  const dialog = DialogPlugin.confirm({
    header: '确认删除',
    body: `确定要删除渠道 "${channel.value?.name}" 吗？如果有应用关联此渠道，将无法删除。`,
    confirmBtn: { content: '删除', theme: 'danger' },
    onConfirm: async () => {
      try {
        await api.deleteChannel(id.value);
        MessagePlugin.success('删除成功');
        router.push('/channels');
      } catch (e: any) {
        MessagePlugin.error(e.message || '删除失败');
      }
      dialog.destroy();
    },
  });
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

// Mask sensitive data
function maskSecret(secret: string) {
  if (!secret) return '-';
  if (secret.length <= 8) return '****';
  return secret.slice(0, 4) + '****' + secret.slice(-4);
}

onMounted(() => {
  fetchChannel();
});
</script>

<template>
  <div class="channel-detail">
    <div class="page-header">
      <t-button theme="default" variant="text" @click="router.push('/channels')">
        <Icon icon="mdi:arrow-left" />
        返回列表
      </t-button>
    </div>

    <t-loading :loading="loading">
      <div v-if="channel" class="detail-content">
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
            <t-descriptions-item label="渠道名称">{{ channel.name }}</t-descriptions-item>
            <t-descriptions-item label="渠道类型">
              <t-tag theme="primary" variant="light">
                {{ channel.type === 'wechat' ? '微信公众号' : channel.type }}
              </t-tag>
            </t-descriptions-item>
            <t-descriptions-item label="渠道 ID">
              <div class="copy-field">
                <code>{{ channel.id }}</code>
                <t-button size="small" variant="text" @click="copyToClipboard(channel.id, '渠道 ID')">
                  <Icon icon="mdi:content-copy" />
                </t-button>
              </div>
            </t-descriptions-item>
            <t-descriptions-item label="创建时间">{{ channel.createdAt }}</t-descriptions-item>
            <t-descriptions-item label="更新时间">{{ channel.updatedAt }}</t-descriptions-item>
          </t-descriptions>
        </t-card>

        <!-- WeChat Config -->
        <t-card title="微信配置" class="config-card">
          <t-descriptions :column="1">
            <t-descriptions-item label="AppID">
              <div class="copy-field">
                <code>{{ channel.config?.appId || '-' }}</code>
                <t-button 
                  v-if="channel.config?.appId" 
                  size="small" 
                  variant="text" 
                  @click="copyToClipboard(channel.config.appId, 'AppID')"
                >
                  <Icon icon="mdi:content-copy" />
                </t-button>
              </div>
            </t-descriptions-item>
            <t-descriptions-item label="AppSecret">
              <code>{{ maskSecret(channel.config?.appSecret) }}</code>
            </t-descriptions-item>
          </t-descriptions>
        </t-card>

        <!-- Usage Tips -->
        <t-card title="使用说明" class="tips-card">
          <div class="tips-content">
            <div class="tip-item">
              <Icon icon="mdi:numeric-1-circle" class="tip-icon" />
              <div class="tip-text">
                <h4>创建应用</h4>
                <p>在"应用管理"中创建应用，选择此渠道作为消息发送通道</p>
              </div>
            </div>
            <div class="tip-item">
              <Icon icon="mdi:numeric-2-circle" class="tip-icon" />
              <div class="tip-text">
                <h4>绑定用户</h4>
                <p>在应用中添加 OpenID，绑定需要接收消息的微信用户</p>
              </div>
            </div>
            <div class="tip-item">
              <Icon icon="mdi:numeric-3-circle" class="tip-icon" />
              <div class="tip-text">
                <h4>发送消息</h4>
                <p>通过应用的 Webhook URL 发送消息，系统会自动使用此渠道配置</p>
              </div>
            </div>
          </div>
        </t-card>
      </div>
    </t-loading>

    <!-- Edit Dialog -->
    <t-dialog
      v-model:visible="showEditDialog"
      header="编辑渠道"
      :confirm-btn="{ content: '保存', loading: saving }"
      @confirm="handleUpdate"
    >
      <t-form>
        <t-form-item label="渠道名称" name="name">
          <t-input v-model="editForm.name" placeholder="请输入渠道名称" />
        </t-form-item>
        <t-form-item label="AppID" name="appId">
          <t-input v-model="editForm.appId" :placeholder="channel?.config?.appId || '微信公众号 AppID'" />
        </t-form-item>
        <t-form-item label="AppSecret" name="appSecret">
          <t-input v-model="editForm.appSecret" type="password" placeholder="留空则不修改" />
        </t-form-item>
      </t-form>
    </t-dialog>
  </div>
</template>

<style scoped>
.channel-detail {
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

.tips-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.tip-item {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.tip-icon {
  font-size: 24px;
  color: var(--td-brand-color);
  flex-shrink: 0;
}

.tip-text h4 {
  margin: 0 0 4px;
  font-size: 14px;
  font-weight: 500;
}

.tip-text p {
  margin: 0;
  font-size: 13px;
  color: var(--td-text-color-secondary);
}
</style>
