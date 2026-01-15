<template>
  <div class="p-6">
    <h1 class="text-2xl font-semibold mb-6">系统设置</h1>

    <div v-if="loading" class="flex justify-center py-12">
      <UIcon name="i-heroicons-arrow-path" class="text-3xl animate-spin text-gray-400" />
    </div>

    <div v-else class="space-y-6">
      <!-- Channel Link -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <span class="font-medium">微信公众号配置</span>
            <NuxtLink to="/channels">
              <UButton variant="ghost" size="sm" trailing-icon="i-heroicons-arrow-right">
                前往渠道管理
              </UButton>
            </NuxtLink>
          </div>
        </template>
        <UAlert color="info" icon="i-heroicons-information-circle">
          <template #description>
            微信公众号配置已移至渠道管理，请在渠道管理中创建和配置微信渠道。
          </template>
        </UAlert>
      </UCard>

      <!-- Rate Limit Config -->
      <UCard>
        <template #header>
          <span class="font-medium">速率限制</span>
        </template>
        <UFormField label="每分钟限制">
          <div class="flex items-center gap-3">
            <UInput
              v-model.number="formData.rateLimit.perMinute"
              type="number"
              :min="1"
              :max="100"
              class="w-32"
            />
            <span class="text-sm text-gray-500 dark:text-gray-400">每个应用每分钟最多发送的消息数</span>
          </div>
        </UFormField>
      </UCard>

      <!-- Retention Config -->
      <UCard>
        <template #header>
          <span class="font-medium">数据保留</span>
        </template>
        <UFormField label="保留天数">
          <div class="flex items-center gap-3">
            <UInput
              v-model.number="formData.retention.days"
              type="number"
              :min="1"
              :max="365"
              class="w-32"
            />
            <span class="text-sm text-gray-500 dark:text-gray-400">消息历史记录保留天数</span>
          </div>
        </UFormField>
      </UCard>

      <!-- Save Button -->
      <div class="flex justify-end">
        <UButton :loading="saving" icon="i-heroicons-check" @click="handleSave">
          保存配置
        </UButton>
      </div>

      <!-- Help Section -->
      <UCard>
        <template #header>
          <span class="font-medium">配置帮助</span>
        </template>
        <UAccordion :items="helpItems" />
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SystemConfig } from '~/types';

definePageMeta({
  layout: 'default',
});

const api = useApi();
const toast = useToast();

// State
const loading = ref(true);
const saving = ref(false);

// Form data (without wechat config)
const formData = reactive({
  rateLimit: {
    perMinute: 5,
  },
  retention: {
    days: 30,
  },
});

const helpItems = [
  {
    label: '如何获取微信公众号 AppID 和 AppSecret？',
    content: `1. 登录微信公众平台 (https://mp.weixin.qq.com)
2. 进入「设置与开发」-「基本配置」
3. 在「公众号开发信息」中查看 AppID
4. 点击「重置」获取 AppSecret（请妥善保管）`,
  },
  {
    label: '如何创建消息模板？',
    content: `1. 在微信公众平台进入「功能」-「模板消息」
2. 从模板库中选择或创建新模板
3. 复制模板 ID 填入应用配置
4. 模板内容建议包含 {{title.DATA}} 和 {{content.DATA}} 字段`,
  },
  {
    label: '如何配置网页授权域名？',
    content: `1. 在微信公众平台进入「设置与开发」-「公众号设置」
2. 选择「功能设置」标签页
3. 在「网页授权域名」中添加您的域名
4. 下载验证文件并上传到网站根目录

注意：网页授权域名用于扫码绑定功能，请确保已正确配置。`,
  },
];

// Load config
async function loadConfig() {
  loading.value = true;
  try {
    const res = await api.getConfig();
    if (res.data) {
      formData.rateLimit.perMinute = res.data.rateLimit?.perMinute || 5;
      formData.retention.days = res.data.retention?.days || 30;
    }
  } catch (e: unknown) {
    const err = e as Error;
    toast.add({ title: err.message || '获取配置失败', color: 'error' });
  } finally {
    loading.value = false;
  }
}

// Save config
async function handleSave() {
  saving.value = true;
  try {
    const updateData: Partial<SystemConfig> = {
      rateLimit: formData.rateLimit,
      retention: formData.retention,
    };

    await api.updateConfig(updateData);
    toast.add({ title: '配置已保存', color: 'success' });
  } catch (e: unknown) {
    const err = e as Error;
    toast.add({ title: err.message || '保存失败', color: 'error' });
  } finally {
    saving.value = false;
  }
}

onMounted(loadConfig);
</script>
