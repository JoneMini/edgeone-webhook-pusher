<template>
  <div class="h-full flex">
    <!-- Desktop: Two-panel layout -->
    <template v-if="!isMobile">
      <!-- List Panel -->
      <div class="w-80 border-r border-gray-200 dark:border-gray-800 flex flex-col bg-white dark:bg-gray-900">
        <div class="p-4 border-b border-gray-200 dark:border-gray-800">
          <div class="flex items-center justify-between mb-4">
            <h1 class="text-lg font-semibold">应用管理</h1>
            <UButton size="sm" icon="i-heroicons-plus" @click="showCreateModal = true">
              新建
            </UButton>
          </div>
        </div>
        <div class="flex-1 overflow-auto p-4">
          <div v-if="loading" class="flex justify-center py-8">
            <UIcon name="i-heroicons-arrow-path" class="text-2xl animate-spin text-gray-400" />
          </div>
          <AppList
            v-else
            :apps="apps"
            :selected-id="selectedId"
            @select="handleSelect"
          />
        </div>
      </div>

      <!-- Detail Panel -->
      <div class="flex-1 overflow-auto p-6 bg-gray-50 dark:bg-gray-950">
        <AppDetail
          v-if="selectedApp"
          :app="selectedApp"
          :channel="selectedChannel"
          @update="fetchData"
          @delete="handleDelete"
        />
        <EmptyState
          v-else
          icon="i-heroicons-cursor-arrow-rays"
          message="选择一个应用查看详情"
        >
          <template #action>
            <UButton v-if="apps.length === 0 && channels.length > 0" @click="showCreateModal = true">
              创建第一个应用
            </UButton>
            <div v-else-if="channels.length === 0" class="text-sm text-gray-500">
              请先 <NuxtLink to="/channels" class="text-primary hover:underline">创建渠道</NuxtLink>
            </div>
          </template>
        </EmptyState>
      </div>
    </template>

    <!-- Mobile: Single column layout -->
    <template v-else>
      <div v-if="!showMobileDetail" class="flex-1 flex flex-col bg-white dark:bg-gray-900">
        <div class="p-4 border-b border-gray-200 dark:border-gray-800">
          <div class="flex items-center justify-between">
            <h1 class="text-lg font-semibold">应用管理</h1>
            <UButton size="sm" icon="i-heroicons-plus" @click="showCreateModal = true">
              新建
            </UButton>
          </div>
        </div>
        <div class="flex-1 overflow-auto p-4">
          <div v-if="loading" class="flex justify-center py-8">
            <UIcon name="i-heroicons-arrow-path" class="text-2xl animate-spin text-gray-400" />
          </div>
          <AppList
            v-else
            :apps="apps"
            :selected-id="selectedId"
            @select="handleMobileSelect"
          />
        </div>
      </div>

      <div v-else class="flex-1 flex flex-col bg-gray-50 dark:bg-gray-950">
        <div class="p-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <UButton variant="ghost" icon="i-heroicons-arrow-left" @click="handleMobileBack">
            返回列表
          </UButton>
        </div>
        <div class="flex-1 overflow-auto p-4">
          <AppDetail
            v-if="selectedApp"
            :app="selectedApp"
            :channel="selectedChannel"
            @update="fetchData"
            @delete="handleMobileDelete"
          />
        </div>
      </div>
    </template>

    <!-- Create Modal -->
    <UModal v-model:open="showCreateModal" title="新建应用">
      <template #body>
        <div class="space-y-4">
          <UFormField label="应用名称">
            <UInput v-model="createForm.name" placeholder="请输入应用名称" />
          </UFormField>
          <UFormField label="关联渠道">
            <USelectMenu
              v-model="createForm.channelId"
              :items="channelOptions"
              placeholder="请选择渠道"
              value-key="value"
            />
          </UFormField>
          <UFormField label="推送模式">
            <URadioGroup v-model="createForm.pushMode" :items="pushModeOptions" />
          </UFormField>
          <UFormField label="消息类型">
            <URadioGroup v-model="createForm.messageType" :items="messageTypeOptions" />
          </UFormField>
          <UFormField v-if="createForm.messageType === 'template'" label="模板 ID">
            <UInput v-model="templateId" placeholder="微信模板消息 ID" />
          </UFormField>
          <UAlert color="info" icon="i-heroicons-information-circle">
            <template #description>
              创建后可通过 Webhook URL 发送消息
            </template>
          </UAlert>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton variant="ghost" @click="showCreateModal = false">取消</UButton>
          <UButton :loading="creating" @click="handleCreate">创建</UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { AppWithCount, Channel, CreateAppInput } from '~/types';
import { PushModes, MessageTypes } from '~/types';

definePageMeta({
  layout: 'default',
});

const route = useRoute();
const api = useApi();
const toast = useToast();

// Responsive
const isMobile = ref(false);
const showMobileDetail = ref(false);

// State
const loading = ref(true);
const apps = ref<AppWithCount[]>([]);
const channels = ref<Channel[]>([]);
const selectedId = ref<string | null>(null);
const showCreateModal = ref(false);
const creating = ref(false);
const templateId = ref('');

const createForm = ref<CreateAppInput>({
  name: '',
  channelId: '',
  pushMode: PushModes.SINGLE,
  messageType: MessageTypes.NORMAL,
});

const selectedApp = computed(() =>
  apps.value.find(a => a.id === selectedId.value)
);

const selectedChannel = computed(() =>
  selectedApp.value ? channels.value.find(c => c.id === selectedApp.value?.channelId) : null
);

const channelOptions = computed(() =>
  channels.value.map(c => ({ label: c.name, value: c.id }))
);

const pushModeOptions = [
  { label: '单播（发送给第一个绑定用户）', value: PushModes.SINGLE },
  { label: '订阅（发送给所有绑定用户）', value: PushModes.SUBSCRIBE },
];

const messageTypeOptions = [
  { label: '普通消息', value: MessageTypes.NORMAL },
  { label: '模板消息', value: MessageTypes.TEMPLATE },
];

// Check responsive
function checkMobile() {
  isMobile.value = window.innerWidth < 768;
}

onMounted(() => {
  checkMobile();
  window.addEventListener('resize', checkMobile);
  fetchData();
  
  // Handle URL query for selected item
  const selected = route.query.selected as string;
  if (selected) {
    selectedId.value = selected;
    if (isMobile.value) {
      showMobileDetail.value = true;
    }
  }
});

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile);
});

async function fetchData() {
  loading.value = true;
  try {
    const [appsRes, channelsRes] = await Promise.all([
      api.getApps(),
      api.getChannels(),
    ]);
    apps.value = appsRes.data || [];
    channels.value = channelsRes.data || [];
  } catch (e: unknown) {
    const err = e as Error;
    toast.add({ title: err.message || '获取数据失败', color: 'error' });
  } finally {
    loading.value = false;
  }
}

function handleSelect(id: string) {
  selectedId.value = id;
}

function handleMobileSelect(id: string) {
  selectedId.value = id;
  showMobileDetail.value = true;
}

function handleMobileBack() {
  showMobileDetail.value = false;
}

function handleDelete() {
  selectedId.value = null;
  fetchData();
}

function handleMobileDelete() {
  selectedId.value = null;
  showMobileDetail.value = false;
  fetchData();
}

async function handleCreate() {
  if (!createForm.value.name.trim()) {
    toast.add({ title: '请输入应用名称', color: 'warning' });
    return;
  }
  if (!createForm.value.channelId) {
    toast.add({ title: '请选择渠道', color: 'warning' });
    return;
  }
  if (createForm.value.messageType === MessageTypes.TEMPLATE && !templateId.value.trim()) {
    toast.add({ title: '模板消息需要填写模板 ID', color: 'warning' });
    return;
  }
  
  creating.value = true;
  try {
    const data: CreateAppInput = {
      name: createForm.value.name.trim(),
      channelId: createForm.value.channelId,
      pushMode: createForm.value.pushMode,
      messageType: createForm.value.messageType,
    };
    if (createForm.value.messageType === MessageTypes.TEMPLATE) {
      data.templateId = templateId.value.trim();
    }
    const res = await api.createApp(data);
    toast.add({ title: '创建成功', color: 'success' });
    showCreateModal.value = false;
    resetCreateForm();
    await fetchData();
    // Auto select the new app
    if (res.data?.id) {
      selectedId.value = res.data.id;
      if (isMobile.value) {
        showMobileDetail.value = true;
      }
    }
  } catch (e: unknown) {
    const err = e as Error;
    toast.add({ title: err.message || '创建失败', color: 'error' });
  } finally {
    creating.value = false;
  }
}

function resetCreateForm() {
  createForm.value = {
    name: '',
    channelId: '',
    pushMode: PushModes.SINGLE,
    messageType: MessageTypes.NORMAL,
  };
  templateId.value = '';
}
</script>
