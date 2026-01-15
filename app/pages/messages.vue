<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-semibold">消息历史</h1>
      <UInput
        v-model="appFilter"
        placeholder="按应用ID筛选"
        icon="i-heroicons-magnifying-glass"
        class="w-48"
        @update:model-value="handleFilterChange"
      />
    </div>

    <UCard>
      <div v-if="loading" class="flex justify-center py-12">
        <UIcon name="i-heroicons-arrow-path" class="text-3xl animate-spin text-gray-400" />
      </div>

      <div v-else-if="messages.length === 0" class="text-center py-12 text-gray-500 dark:text-gray-400">
        <UIcon name="i-heroicons-chat-bubble-left-right" class="text-5xl mb-3 opacity-50" />
        <p>暂无消息记录</p>
      </div>

      <UTable v-else :data="messages" :columns="columns">
        <template #status-cell="{ row }">
          <UBadge :color="getStatusInfo(row.original.results).color" variant="subtle" size="xs">
            {{ getStatusInfo(row.original.results).label }}
          </UBadge>
        </template>

        <template #createdAt-cell="{ row }">
          {{ formatTime(row.original.createdAt) }}
        </template>

        <template #actions-cell="{ row }">
          <UButton variant="ghost" size="xs" icon="i-heroicons-eye" @click="showDetail(row.original)" />
        </template>
      </UTable>

      <div v-if="pagination.total > pagination.pageSize" class="flex justify-center mt-4">
        <UPagination
          v-model:page="pagination.current"
          :total="pagination.total"
          :page-count="pagination.pageSize"
          @update:page="handlePageChange"
        />
      </div>
    </UCard>

    <!-- Detail Modal -->
    <UModal v-model:open="showDetailModal" title="消息详情" class="max-w-2xl">
      <template #body>
        <div v-if="selectedMessage" class="space-y-4">
          <dl class="space-y-3">
            <div class="flex justify-between py-2 border-b border-gray-100 dark:border-gray-800">
              <dt class="text-gray-500 dark:text-gray-400">消息ID</dt>
              <dd><code class="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">{{ selectedMessage.id }}</code></dd>
            </div>
            <div class="flex justify-between py-2 border-b border-gray-100 dark:border-gray-800">
              <dt class="text-gray-500 dark:text-gray-400">应用ID</dt>
              <dd>{{ selectedMessage.appId }}</dd>
            </div>
            <div class="flex justify-between py-2 border-b border-gray-100 dark:border-gray-800">
              <dt class="text-gray-500 dark:text-gray-400">标题</dt>
              <dd>{{ selectedMessage.title }}</dd>
            </div>
            <div class="py-2 border-b border-gray-100 dark:border-gray-800">
              <dt class="text-gray-500 dark:text-gray-400 mb-2">内容</dt>
              <dd>
                <pre class="text-sm bg-gray-50 dark:bg-gray-800 p-3 rounded-lg whitespace-pre-wrap break-all max-h-40 overflow-auto">{{ selectedMessage.desp || '无' }}</pre>
              </dd>
            </div>
            <div class="flex justify-between py-2">
              <dt class="text-gray-500 dark:text-gray-400">发送时间</dt>
              <dd>{{ formatTime(selectedMessage.createdAt) }}</dd>
            </div>
          </dl>

          <UDivider label="发送结果" />

          <div class="space-y-2">
            <div
              v-for="(result, i) in selectedMessage.results"
              :key="i"
              class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
            >
              <div class="flex items-center gap-3">
                <UIcon name="i-heroicons-user" class="text-lg text-primary" />
                <span class="text-sm font-mono">{{ result.openId }}</span>
              </div>
              <UBadge :color="result.success ? 'success' : 'error'" variant="subtle" size="xs">
                {{ result.success ? '成功' : '失败' }}
              </UBadge>
            </div>
          </div>

          <UAlert
            v-if="selectedMessage.results?.some(r => r.error)"
            color="error"
            icon="i-heroicons-exclamation-triangle"
            title="错误信息"
          >
            <div v-for="(r, i) in selectedMessage.results" :key="i">
              <div v-if="r.error" class="text-sm">
                {{ r.openId }}: {{ r.error }}
              </div>
            </div>
          </UAlert>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { Message, DeliveryResult, PaginatedResponse } from '~/types';

definePageMeta({
  layout: 'default',
});

const api = useApi();
const toast = useToast();

// State
const loading = ref(true);
const messages = ref<Message[]>([]);
const showDetailModal = ref(false);
const selectedMessage = ref<Message | null>(null);
const appFilter = ref('');

// Pagination
const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
});

// Table columns
const columns = [
  { accessorKey: 'title', header: '标题' },
  { accessorKey: 'appId', header: '应用ID' },
  { accessorKey: 'status', header: '状态' },
  { accessorKey: 'createdAt', header: '时间' },
  { accessorKey: 'actions', header: '操作' },
];

// Format time
function formatTime(iso: string) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('zh-CN');
}

// Get status info
function getStatusInfo(results: DeliveryResult[]) {
  if (!results || results.length === 0) {
    return { label: '未知', color: 'neutral' as const };
  }
  const allSuccess = results.every(r => r.success);
  const allFailed = results.every(r => !r.success);
  
  if (allSuccess) return { label: '成功', color: 'success' as const };
  if (allFailed) return { label: '失败', color: 'error' as const };
  return { label: '部分成功', color: 'warning' as const };
}

// Load messages
async function loadMessages() {
  loading.value = true;
  try {
    const params = {
      page: pagination.current,
      pageSize: pagination.pageSize,
      appId: appFilter.value || undefined,
    };
    
    const res = await api.getMessages(params);
    if (res.code === 0 && res.data) {
      const data = res.data as PaginatedResponse<Message>;
      messages.value = data.items || [];
      pagination.total = data.pagination?.total || 0;
    } else {
      toast.add({ title: res.message || '获取消息列表失败', color: 'error' });
    }
  } catch (e: unknown) {
    const err = e as Error;
    toast.add({ title: err.message || '获取消息列表失败', color: 'error' });
  } finally {
    loading.value = false;
  }
}

// Handle page change
function handlePageChange() {
  loadMessages();
}

// Handle filter change
function handleFilterChange() {
  pagination.current = 1;
  loadMessages();
}

// Show detail
function showDetail(msg: Message) {
  selectedMessage.value = msg;
  showDetailModal.value = true;
}

onMounted(loadMessages);
</script>
