<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
          <UIcon name="i-heroicons-cube" class="text-blue-600 dark:text-blue-400 text-2xl" />
        </div>
        <div>
          <h2 class="text-lg font-semibold">{{ app.name }}</h2>
          <div class="flex gap-1 mt-1">
            <UBadge :color="app.pushMode === 'single' ? 'primary' : 'info'" variant="subtle" size="xs">
              {{ app.pushMode === 'single' ? '单播' : '订阅' }}
            </UBadge>
            <UBadge :color="app.messageType === 'template' ? 'warning' : 'neutral'" variant="subtle" size="xs">
              {{ app.messageType === 'template' ? '模板消息' : '普通消息' }}
            </UBadge>
          </div>
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
          <dt class="text-gray-500 dark:text-gray-400">App Key</dt>
          <dd class="flex items-center gap-2">
            <code class="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">{{ app.key }}</code>
            <UButton variant="ghost" size="xs" icon="i-heroicons-clipboard" @click="copyToClipboard(app.key, 'App Key')" />
          </dd>
        </div>
        <div class="flex justify-between">
          <dt class="text-gray-500 dark:text-gray-400">关联渠道</dt>
          <dd>
            <UBadge v-if="channel" color="success" variant="subtle">
              <UIcon name="i-heroicons-signal" class="mr-1" />
              {{ channel.name }}
            </UBadge>
            <span v-else class="text-gray-400">{{ app.channelId }}</span>
          </dd>
        </div>
        <div v-if="app.messageType === 'template'" class="flex justify-between">
          <dt class="text-gray-500 dark:text-gray-400">模板 ID</dt>
          <dd>
            <code class="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">{{ app.templateId || '-' }}</code>
          </dd>
        </div>
        <div class="flex justify-between">
          <dt class="text-gray-500 dark:text-gray-400">创建时间</dt>
          <dd>{{ app.createdAt }}</dd>
        </div>
      </dl>
    </UCard>

    <!-- OpenID Management -->
    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <span class="font-medium">绑定用户</span>
          <UButton size="xs" variant="ghost" icon="i-heroicons-plus" @click="showAddOpenIdModal = true">
            添加
          </UButton>
        </div>
      </template>
      
      <div v-if="openIds.length === 0" class="text-center py-6 text-gray-500 dark:text-gray-400">
        <UIcon name="i-heroicons-user-minus" class="text-3xl mb-2 opacity-50" />
        <p class="text-sm">暂无绑定用户</p>
        <UButton size="sm" class="mt-2" @click="showAddOpenIdModal = true">
          添加第一个 OpenID
        </UButton>
      </div>

      <div v-else class="space-y-2">
        <div
          v-for="item in openIds"
          :key="item.id"
          class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
        >
          <div class="flex items-center gap-3">
            <UIcon name="i-heroicons-user" class="text-lg text-primary" />
            <div>
              <div class="font-medium text-sm">{{ item.nickname || item.openId }}</div>
              <div v-if="item.nickname" class="text-xs text-gray-500 dark:text-gray-400 font-mono">{{ item.openId }}</div>
              <div v-if="item.remark" class="text-xs text-gray-400">{{ item.remark }}</div>
            </div>
          </div>
          <UButton variant="ghost" color="error" size="xs" icon="i-heroicons-trash" @click="handleDeleteOpenId(item)" />
        </div>
      </div>
    </UCard>

    <!-- Webhook Usage -->
    <UCard>
      <template #header>
        <span class="font-medium">Webhook 使用</span>
      </template>
      
      <div class="space-y-4">
        <div>
          <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Webhook URL</label>
          <div class="flex items-center gap-2">
            <code class="flex-1 text-xs bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded overflow-x-auto">{{ webhookUrl }}</code>
            <UButton variant="ghost" size="sm" icon="i-heroicons-clipboard" @click="copyToClipboard(webhookUrl, 'Webhook URL')" />
          </div>
        </div>

        <UTabs :items="usageTabs" class="mt-4">
          <template #curl>
            <pre class="text-xs bg-gray-100 dark:bg-gray-800 p-4 rounded-lg overflow-x-auto"><code>curl "{{ webhookUrl }}?title=测试消息&amp;desp=这是消息内容"</code></pre>
          </template>
          <template #post>
            <pre class="text-xs bg-gray-100 dark:bg-gray-800 p-4 rounded-lg overflow-x-auto"><code>curl -X POST "{{ webhookUrl }}" \
  -H "Content-Type: application/json" \
  -d '{"title":"测试消息","desp":"这是消息内容"}'</code></pre>
          </template>
          <template #browser>
            <p class="text-sm text-gray-500 dark:text-gray-400 mb-2">直接在浏览器地址栏访问：</p>
            <pre class="text-xs bg-gray-100 dark:bg-gray-800 p-4 rounded-lg overflow-x-auto"><code>{{ webhookUrl }}?title=测试消息&amp;desp=这是消息内容</code></pre>
          </template>
        </UTabs>
      </div>
    </UCard>

    <!-- Edit Modal -->
    <UModal v-model:open="showEditModal" title="编辑应用">
      <template #body>
        <div class="space-y-4">
          <UFormField label="应用名称">
            <UInput v-model="editForm.name" placeholder="请输入应用名称" />
          </UFormField>
          <UFormField v-if="app.messageType === 'template'" label="模板 ID">
            <UInput v-model="editForm.templateId" placeholder="微信模板消息 ID" />
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

    <!-- Add OpenID Modal -->
    <UModal v-model:open="showAddOpenIdModal" title="添加 OpenID">
      <template #body>
        <div class="space-y-4">
          <UFormField label="OpenID">
            <UInput v-model="addOpenIdForm.openId" placeholder="微信用户 OpenID" />
          </UFormField>
          <UFormField label="昵称">
            <UInput v-model="addOpenIdForm.nickname" placeholder="可选，便于识别" />
          </UFormField>
          <UFormField label="备注">
            <UInput v-model="addOpenIdForm.remark" placeholder="可选" />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton variant="ghost" @click="showAddOpenIdModal = false">取消</UButton>
          <UButton :loading="addingOpenId" @click="handleAddOpenId">添加</UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { AppWithCount, Channel, OpenID, UpdateAppInput, CreateOpenIDInput } from '~/types';

const props = defineProps<{
  app: AppWithCount;
  channel?: Channel | null;
}>();

const emit = defineEmits<{
  update: [];
  delete: [];
}>();

const api = useApi();
const toast = useToast();

// State
const openIds = ref<OpenID[]>([]);
const showEditModal = ref(false);
const showAddOpenIdModal = ref(false);
const saving = ref(false);
const addingOpenId = ref(false);

const editForm = ref({ name: '', templateId: '' });
const addOpenIdForm = ref<CreateOpenIDInput>({ openId: '', nickname: '', remark: '' });

const webhookUrl = computed(() => {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/send/${props.app.key}`;
});

const usageTabs = [
  { label: 'cURL', slot: 'curl' },
  { label: 'POST', slot: 'post' },
  { label: '浏览器', slot: 'browser' },
];

watch(() => props.app, (app) => {
  editForm.value = {
    name: app.name,
    templateId: app.templateId || '',
  };
  fetchOpenIds();
}, { immediate: true });

async function fetchOpenIds() {
  try {
    const res = await api.getAppOpenIds(props.app.id);
    openIds.value = res.data || [];
  } catch (e) {
    console.error('Failed to fetch openIds:', e);
  }
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
    toast.add({ title: '请输入应用名称', color: 'warning' });
    return;
  }
  if (props.app.messageType === 'template' && !editForm.value.templateId.trim()) {
    toast.add({ title: '模板消息需要填写模板 ID', color: 'warning' });
    return;
  }
  saving.value = true;
  try {
    const updateData: UpdateAppInput = { name: editForm.value.name.trim() };
    if (props.app.messageType === 'template') {
      updateData.templateId = editForm.value.templateId.trim();
    }
    await api.updateApp(props.app.id, updateData);
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
  const confirmed = window.confirm(`确定要删除应用 "${props.app.name}" 吗？此操作将同时删除所有绑定的 OpenID。`);
  if (!confirmed) return;
  
  try {
    await api.deleteApp(props.app.id);
    toast.add({ title: '删除成功', color: 'success' });
    emit('delete');
  } catch (e: unknown) {
    const err = e as Error;
    toast.add({ title: err.message || '删除失败', color: 'error' });
  }
}

async function handleAddOpenId() {
  if (!addOpenIdForm.value.openId.trim()) {
    toast.add({ title: '请输入 OpenID', color: 'warning' });
    return;
  }
  addingOpenId.value = true;
  try {
    await api.createAppOpenId(props.app.id, {
      openId: addOpenIdForm.value.openId.trim(),
      nickname: addOpenIdForm.value.nickname?.trim() || undefined,
      remark: addOpenIdForm.value.remark?.trim() || undefined,
    });
    toast.add({ title: '添加成功', color: 'success' });
    showAddOpenIdModal.value = false;
    addOpenIdForm.value = { openId: '', nickname: '', remark: '' };
    await fetchOpenIds();
  } catch (e: unknown) {
    const err = e as Error;
    toast.add({ title: err.message || '添加失败', color: 'error' });
  } finally {
    addingOpenId.value = false;
  }
}

async function handleDeleteOpenId(item: OpenID) {
  const confirmed = window.confirm(`确定要删除 OpenID "${item.nickname || item.openId}" 吗？`);
  if (!confirmed) return;
  
  try {
    await api.deleteAppOpenId(props.app.id, item.id);
    toast.add({ title: '删除成功', color: 'success' });
    await fetchOpenIds();
  } catch (e: unknown) {
    const err = e as Error;
    toast.add({ title: err.message || '删除失败', color: 'error' });
  }
}
</script>
