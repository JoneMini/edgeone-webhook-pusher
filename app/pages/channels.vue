<template>
  <div class="h-full flex">
    <!-- Desktop: Two-panel layout -->
    <template v-if="!isMobile">
      <!-- List Panel -->
      <div class="w-80 border-r border-gray-200 dark:border-gray-800 flex flex-col bg-white dark:bg-gray-900">
        <div class="p-4 border-b border-gray-200 dark:border-gray-800">
          <div class="flex items-center justify-between mb-4">
            <h1 class="text-lg font-semibold">渠道管理</h1>
            <UButton size="sm" icon="i-heroicons-plus" @click="showCreateModal = true">
              新建
            </UButton>
          </div>
        </div>
        <div class="flex-1 overflow-auto p-4">
          <div v-if="loading" class="flex justify-center py-8">
            <UIcon name="i-heroicons-arrow-path" class="text-2xl animate-spin text-gray-400" />
          </div>
          <ChannelList
            v-else
            :channels="channels"
            :selected-id="selectedId"
            @select="handleSelect"
          />
        </div>
      </div>

      <!-- Detail Panel -->
      <div class="flex-1 overflow-auto p-6 bg-gray-50 dark:bg-gray-950">
        <ChannelDetail
          v-if="selectedChannel"
          :channel="selectedChannel"
          @update="fetchChannels"
          @delete="handleDelete"
        />
        <EmptyState
          v-else
          icon="i-heroicons-cursor-arrow-rays"
          message="选择一个渠道查看详情"
        >
          <template #action>
            <UButton v-if="channels.length === 0" @click="showCreateModal = true">
              创建第一个渠道
            </UButton>
          </template>
        </EmptyState>
      </div>
    </template>

    <!-- Mobile: Single column layout -->
    <template v-else>
      <div v-if="!showMobileDetail" class="flex-1 flex flex-col bg-white dark:bg-gray-900">
        <div class="p-4 border-b border-gray-200 dark:border-gray-800">
          <div class="flex items-center justify-between">
            <h1 class="text-lg font-semibold">渠道管理</h1>
            <UButton size="sm" icon="i-heroicons-plus" @click="showCreateModal = true">
              新建
            </UButton>
          </div>
        </div>
        <div class="flex-1 overflow-auto p-4">
          <div v-if="loading" class="flex justify-center py-8">
            <UIcon name="i-heroicons-arrow-path" class="text-2xl animate-spin text-gray-400" />
          </div>
          <ChannelList
            v-else
            :channels="channels"
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
          <ChannelDetail
            v-if="selectedChannel"
            :channel="selectedChannel"
            @update="fetchChannels"
            @delete="handleMobileDelete"
          />
        </div>
      </div>
    </template>

    <!-- Create Modal -->
    <UModal v-model:open="showCreateModal" title="新建渠道">
      <template #body>
        <div class="space-y-4">
          <UFormField label="渠道名称">
            <UInput v-model="createForm.name" placeholder="请输入渠道名称" />
          </UFormField>
          <UFormField label="渠道类型">
            <USelect v-model="createForm.type" :items="[{ label: '微信公众号', value: 'wechat' }]" disabled />
          </UFormField>
          <UFormField label="AppID">
            <UInput v-model="createForm.config.appId" placeholder="微信公众号 AppID" />
          </UFormField>
          <UFormField label="AppSecret">
            <UInput v-model="createForm.config.appSecret" type="password" placeholder="微信公众号 AppSecret" />
          </UFormField>
          <UAlert color="info" icon="i-heroicons-information-circle">
            <template #description>
              渠道用于配置消息发送通道，创建后可在应用中引用
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
import type { Channel, CreateChannelInput } from '~/types';
import { ChannelTypes } from '~/types';

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
const channels = ref<Channel[]>([]);
const selectedId = ref<string | null>(null);
const showCreateModal = ref(false);
const creating = ref(false);

const createForm = ref<CreateChannelInput>({
  name: '',
  type: ChannelTypes.WECHAT,
  config: {
    appId: '',
    appSecret: '',
  },
});

const selectedChannel = computed(() =>
  channels.value.find(c => c.id === selectedId.value)
);

// Check responsive
function checkMobile() {
  isMobile.value = window.innerWidth < 768;
}

onMounted(() => {
  checkMobile();
  window.addEventListener('resize', checkMobile);
  fetchChannels();
  
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

async function fetchChannels() {
  loading.value = true;
  try {
    const res = await api.getChannels();
    channels.value = res.data || [];
  } catch (e: unknown) {
    const err = e as Error;
    toast.add({ title: err.message || '获取渠道列表失败', color: 'error' });
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
  fetchChannels();
}

function handleMobileDelete() {
  selectedId.value = null;
  showMobileDetail.value = false;
  fetchChannels();
}

async function handleCreate() {
  if (!createForm.value.name.trim()) {
    toast.add({ title: '请输入渠道名称', color: 'warning' });
    return;
  }
  if (!createForm.value.config.appId.trim()) {
    toast.add({ title: '请输入 AppID', color: 'warning' });
    return;
  }
  if (!createForm.value.config.appSecret.trim()) {
    toast.add({ title: '请输入 AppSecret', color: 'warning' });
    return;
  }
  
  creating.value = true;
  try {
    const res = await api.createChannel(createForm.value);
    toast.add({ title: '创建成功', color: 'success' });
    showCreateModal.value = false;
    resetCreateForm();
    await fetchChannels();
    // Auto select the new channel
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
    type: ChannelTypes.WECHAT,
    config: {
      appId: '',
      appSecret: '',
    },
  };
}
</script>
