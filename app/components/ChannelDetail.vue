<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <UIcon name="i-heroicons-signal" class="text-green-600 dark:text-green-400 text-2xl" />
        </div>
        <div>
          <h2 class="text-lg font-semibold">{{ channel.name }}</h2>
          <UBadge color="primary" variant="subtle" size="xs">
            {{ channel.type === 'wechat' ? '微信公众号' : channel.type }}
          </UBadge>
        </div>
      </div>
      <div class="flex gap-2">
        <UButton variant="ghost" icon="i-heroicons-pencil" @click="showEditModal = true">
          编辑
        </UButton>
        <UButton variant="ghost" color="error" icon="i-heroicons-trash" @click="handleDelete">
          删除
        </UButton>
      </div>
    </div>

    <!-- Info Card -->
    <UCard>
      <template #header>
        <span class="font-medium">基本信息</span>
      </template>
      <dl class="space-y-4">
        <div class="flex justify-between">
          <dt class="text-gray-500 dark:text-gray-400">渠道 ID</dt>
          <dd class="flex items-center gap-2">
            <code class="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">{{ channel.id }}</code>
            <UButton variant="ghost" size="xs" icon="i-heroicons-clipboard" @click="copyToClipboard(channel.id, '渠道 ID')" />
          </dd>
        </div>
        <div class="flex justify-between">
          <dt class="text-gray-500 dark:text-gray-400">创建时间</dt>
          <dd>{{ channel.createdAt }}</dd>
        </div>
        <div class="flex justify-between">
          <dt class="text-gray-500 dark:text-gray-400">更新时间</dt>
          <dd>{{ channel.updatedAt }}</dd>
        </div>
      </dl>
    </UCard>

    <!-- WeChat Config Card -->
    <UCard>
      <template #header>
        <span class="font-medium">微信配置</span>
      </template>
      <dl class="space-y-4">
        <div class="flex justify-between">
          <dt class="text-gray-500 dark:text-gray-400">AppID</dt>
          <dd class="flex items-center gap-2">
            <code class="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">{{ channel.config?.appId || '-' }}</code>
            <UButton v-if="channel.config?.appId" variant="ghost" size="xs" icon="i-heroicons-clipboard" @click="copyToClipboard(channel.config.appId, 'AppID')" />
          </dd>
        </div>
        <div class="flex justify-between">
          <dt class="text-gray-500 dark:text-gray-400">AppSecret</dt>
          <dd>
            <code class="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">{{ maskSecret(channel.config?.appSecret) }}</code>
          </dd>
        </div>
      </dl>
    </UCard>

    <!-- Usage Tips -->
    <UCard>
      <template #header>
        <span class="font-medium">使用说明</span>
      </template>
      <div class="space-y-4">
        <div class="flex gap-3">
          <div class="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center shrink-0">
            <span class="text-primary font-medium text-sm">1</span>
          </div>
          <div>
            <div class="font-medium text-sm">创建应用</div>
            <div class="text-xs text-gray-500 dark:text-gray-400">在"应用管理"中创建应用，选择此渠道作为消息发送通道</div>
          </div>
        </div>
        <div class="flex gap-3">
          <div class="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center shrink-0">
            <span class="text-primary font-medium text-sm">2</span>
          </div>
          <div>
            <div class="font-medium text-sm">绑定用户</div>
            <div class="text-xs text-gray-500 dark:text-gray-400">在应用中添加 OpenID，绑定需要接收消息的微信用户</div>
          </div>
        </div>
        <div class="flex gap-3">
          <div class="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center shrink-0">
            <span class="text-primary font-medium text-sm">3</span>
          </div>
          <div>
            <div class="font-medium text-sm">发送消息</div>
            <div class="text-xs text-gray-500 dark:text-gray-400">通过应用的 Webhook URL 发送消息，系统会自动使用此渠道配置</div>
          </div>
        </div>
      </div>
    </UCard>

    <!-- Edit Modal -->
    <UModal v-model:open="showEditModal" title="编辑渠道">
      <template #body>
        <div class="space-y-4">
          <UFormField label="渠道名称">
            <UInput v-model="editForm.name" placeholder="请输入渠道名称" />
          </UFormField>
          <UFormField label="AppID">
            <UInput v-model="editForm.appId" :placeholder="channel.config?.appId || '微信公众号 AppID'" />
          </UFormField>
          <UFormField label="AppSecret">
            <UInput v-model="editForm.appSecret" type="password" placeholder="留空则不修改" />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton variant="ghost" @click="showEditModal = false">取消</UButton>
          <UButton :loading="saving" @click="handleUpdate">保存</UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { Channel, UpdateChannelInput } from '~/types';

const props = defineProps<{
  channel: Channel;
}>();

const emit = defineEmits<{
  update: [];
  delete: [];
}>();

const api = useApi();
const toast = useToast();

const showEditModal = ref(false);
const saving = ref(false);
const editForm = ref({
  name: '',
  appId: '',
  appSecret: '',
});

watch(() => props.channel, (ch) => {
  editForm.value = {
    name: ch.name,
    appId: ch.config?.appId || '',
    appSecret: '',
  };
}, { immediate: true });

function maskSecret(secret: string | undefined) {
  if (!secret) return '-';
  if (secret.length <= 8) return '****';
  return secret.slice(0, 4) + '****' + secret.slice(-4);
}

async function copyToClipboard(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.add({ title: `${label}已复制`, color: 'success' });
  } catch {
    toast.add({ title: '复制失败', color: 'error' });
  }
}

async function handleUpdate() {
  if (!editForm.value.name.trim()) {
    toast.add({ title: '请输入渠道名称', color: 'warning' });
    return;
  }
  saving.value = true;
  try {
    const updateData: UpdateChannelInput = {
      name: editForm.value.name.trim(),
    };
    if (editForm.value.appId.trim() || editForm.value.appSecret.trim()) {
      updateData.config = {
        appId: editForm.value.appId.trim() || props.channel.config?.appId,
        appSecret: editForm.value.appSecret.trim() || props.channel.config?.appSecret,
      };
    }
    await api.updateChannel(props.channel.id, updateData);
    toast.add({ title: '更新成功', color: 'success' });
    showEditModal.value = false;
    emit('update');
  } catch (e: unknown) {
    const err = e as Error;
    toast.add({ title: err.message || '更新失败', color: 'error' });
  } finally {
    saving.value = false;
  }
}

async function handleDelete() {
  const confirmed = window.confirm(`确定要删除渠道 "${props.channel.name}" 吗？如果有应用关联此渠道，将无法删除。`);
  if (!confirmed) return;
  
  try {
    await api.deleteChannel(props.channel.id);
    toast.add({ title: '删除成功', color: 'success' });
    emit('delete');
  } catch (e: unknown) {
    const err = e as Error;
    toast.add({ title: err.message || '删除失败', color: 'error' });
  }
}
</script>
