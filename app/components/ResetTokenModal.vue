<template>
  <div v-if="show" class="fixed inset-0 z-50 overflow-x-hidden overflow-y-auto">
    <div class="min-h-screen flex items-center justify-center p-4">
      <div class="flex flex-col bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-lg rounded-xl w-full max-w-md">
        <!-- Confirm Dialog -->
        <div v-if="step === 'confirm'">
          <div class="flex justify-between items-center py-3 px-4 border-b border-gray-200 dark:border-gray-800">
            <h3 class="font-semibold text-gray-800 dark:text-gray-200">确认重置登录密钥</h3>
            <button
              type="button"
              class="p-2 text-gray-400 hover:text-gray-500 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              @click="handleClose"
            >
              <Icon icon="heroicons:x-mark" class="text-xl" />
            </button>
          </div>
          <div class="p-4">
            <div class="flex items-start gap-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg mb-4">
              <Icon icon="heroicons:exclamation-triangle" class="text-yellow-500 text-xl shrink-0 mt-0.5" />
              <div class="text-sm text-yellow-700 dark:text-yellow-400">
                <div class="font-medium mb-1">重要提示</div>
                <ul class="text-xs space-y-1 list-disc list-inside">
                  <li>重置后，旧的登录密钥将立即失效</li>
                  <li>您需要使用新密钥重新登录</li>
                  <li>请务必保存新密钥，否则将无法登录系统</li>
                </ul>
              </div>
            </div>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              确定要重置登录密钥吗？此操作不可撤销。
            </p>
          </div>
          <div class="flex justify-end gap-2 py-3 px-4 border-t border-gray-200 dark:border-gray-800">
            <button
              class="px-4 py-2 text-sm font-medium rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              @click="handleClose"
            >
              取消
            </button>
            <button
              :disabled="resetting"
              class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
              @click="handleReset"
            >
              <Icon v-if="resetting" icon="heroicons:arrow-path" class="text-base animate-spin" />
              确认重置
            </button>
          </div>
        </div>

        <!-- Result Dialog -->
        <div v-else-if="step === 'result'">
          <div class="flex justify-between items-center py-3 px-4 border-b border-gray-200 dark:border-gray-800">
            <h3 class="font-semibold text-gray-800 dark:text-gray-200">重置成功</h3>
            <button
              type="button"
              class="p-2 text-gray-400 hover:text-gray-500 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              @click="handleClose"
            >
              <Icon icon="heroicons:x-mark" class="text-xl" />
            </button>
          </div>
          <div class="p-4">
            <div class="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg mb-4">
              <Icon icon="heroicons:check-circle" class="text-green-500 text-xl shrink-0 mt-0.5" />
              <div class="text-sm text-green-700 dark:text-green-400">
                <div class="font-medium mb-1">密钥已重置</div>
                <div class="text-xs">请立即复制并保存新密钥。旧密钥已失效。</div>
              </div>
            </div>

            <div class="space-y-3">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">新登录密钥</label>
                <div class="flex items-center gap-2">
                  <code class="flex-1 text-xs bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded overflow-x-auto break-all">{{ newToken }}</code>
                  <button
                    class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-gray-800 shrink-0"
                    @click="handleCopy"
                  >
                    <Icon icon="heroicons:clipboard" class="text-base" />
                  </button>
                </div>
              </div>

              <div class="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <div class="flex items-start gap-2">
                  <Icon icon="heroicons:exclamation-circle" class="text-red-500 text-lg shrink-0 mt-0.5" />
                  <div class="text-xs text-red-700 dark:text-red-400">
                    <div class="font-medium mb-1">请务必保存此密钥</div>
                    <div>关闭此对话框后将无法再次查看。如果丢失，您将无法登录系统。</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="flex justify-end gap-2 py-3 px-4 border-t border-gray-200 dark:border-gray-800">
            <button
              class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors"
              @click="handleClose"
            >
              <Icon icon="heroicons:check" class="text-base" />
              我已保存
            </button>
          </div>
        </div>

        <!-- Error Dialog -->
        <div v-else-if="step === 'error'">
          <div class="flex justify-between items-center py-3 px-4 border-b border-gray-200 dark:border-gray-800">
            <h3 class="font-semibold text-gray-800 dark:text-gray-200">重置失败</h3>
            <button
              type="button"
              class="p-2 text-gray-400 hover:text-gray-500 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              @click="handleClose"
            >
              <Icon icon="heroicons:x-mark" class="text-xl" />
            </button>
          </div>
          <div class="p-4">
            <div class="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg mb-4">
              <Icon icon="heroicons:x-circle" class="text-red-500 text-xl shrink-0 mt-0.5" />
              <div class="text-sm text-red-700 dark:text-red-400">
                <div class="font-medium mb-1">操作失败</div>
                <div class="text-xs">{{ errorMessage }}</div>
              </div>
            </div>
          </div>
          <div class="flex justify-end gap-2 py-3 px-4 border-t border-gray-200 dark:border-gray-800">
            <button
              class="px-4 py-2 text-sm font-medium rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              @click="handleClose"
            >
              关闭
            </button>
            <button
              class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors"
              @click="handleRetry"
            >
              重试
            </button>
          </div>
        </div>
      </div>
      <div class="fixed inset-0 bg-black/50 -z-10" @click="handleClose"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue';

const props = defineProps<{
  show: boolean;
}>();

const emit = defineEmits<{
  close: [];
  success: [token: string];
}>();

const api = useApi();
const toast = useToast();

const step = ref<'confirm' | 'result' | 'error'>('confirm');
const resetting = ref(false);
const newToken = ref('');
const errorMessage = ref('');

watch(() => props.show, (show) => {
  if (show) {
    // Reset state when modal opens
    step.value = 'confirm';
    resetting.value = false;
    newToken.value = '';
    errorMessage.value = '';
  }
});

async function handleReset() {
  resetting.value = true;
  errorMessage.value = '';

  try {
    const response = await api.resetAdminToken();
    if (response.data) {
      newToken.value = response.data.adminToken;
      step.value = 'result';
      emit('success', response.data.adminToken);
    }
  } catch (e: unknown) {
    const err = e as Error;
    errorMessage.value = err.message || '重置失败，请稍后重试';
    step.value = 'error';
  } finally {
    resetting.value = false;
  }
}

async function handleCopy() {
  try {
    await navigator.clipboard.writeText(newToken.value);
    toast.add({ title: '密钥已复制', color: 'success' });
  } catch {
    toast.add({ title: '复制失败，请手动复制', color: 'error' });
  }
}

function handleClose() {
  emit('close');
}

function handleRetry() {
  step.value = 'confirm';
  errorMessage.value = '';
}
</script>
