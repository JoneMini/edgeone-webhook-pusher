<template>
  <div class="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-primary-600 to-primary-800 p-6">
    <div class="w-full max-w-sm">
      <!-- Header -->
      <div class="text-center text-white mb-8">
        <div class="w-16 h-16 mx-auto mb-4 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur">
          <UIcon name="i-heroicons-bolt" class="text-3xl" />
        </div>
        <h1 class="text-2xl font-bold mb-1">Webhook Pusher</h1>
        <p class="text-white/80 text-sm">消息推送服务管理后台</p>
      </div>

      <!-- Loading State -->
      <UCard v-if="checking">
        <div class="text-center py-12">
          <UIcon name="i-heroicons-arrow-path" class="text-4xl animate-spin text-primary mb-4" />
          <p class="text-muted">检查初始化状态...</p>
        </div>
      </UCard>

      <!-- Init Mode -->
      <UCard v-else-if="!isInitialized">
        <!-- Before Init -->
        <template v-if="!generatedToken">
          <div class="text-center py-8 px-2">
            <div class="w-16 h-16 mx-auto mb-4 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center">
              <UIcon name="i-heroicons-rocket-launch" class="text-3xl text-primary" />
            </div>
            <h2 class="text-lg font-semibold mb-2">首次使用</h2>
            <p class="text-muted text-sm mb-6">
              系统尚未初始化，点击下方按钮生成管理令牌
            </p>
            <UButton size="lg" block :loading="initializing" icon="i-heroicons-play" @click="handleInit">
              开始初始化
            </UButton>
          </div>
        </template>

        <!-- After Init - Show Token -->
        <template v-else>
          <div class="py-6 px-2">
            <div class="text-center mb-6">
              <div class="w-16 h-16 mx-auto mb-4 bg-success-100 dark:bg-success-900/30 rounded-full flex items-center justify-center">
                <UIcon name="i-heroicons-check-circle" class="text-3xl text-success" />
              </div>
              <h2 class="text-lg font-semibold">初始化成功</h2>
            </div>
            
            <UAlert color="warning" icon="i-heroicons-exclamation-triangle" class="mb-4">
              <template #description>
                请妥善保存管理令牌，丢失后无法找回！
              </template>
            </UAlert>

            <div class="space-y-4">
              <UFormField label="管理令牌" class="w-full">
                <UInput :model-value="generatedToken" readonly class="w-full font-mono text-sm" />
              </UFormField>

              <UButton variant="outline" block icon="i-heroicons-clipboard-document" @click="copyToken">
                复制令牌
              </UButton>

              <UButton size="lg" block @click="confirmAndLogin">
                进入管理后台
              </UButton>
            </div>
          </div>
        </template>
      </UCard>

      <!-- Login Mode -->
      <UCard v-else>
        <div class="py-6 px-2">
          <div class="text-center mb-6">
            <div class="w-16 h-16 mx-auto mb-4 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center">
              <UIcon name="i-heroicons-lock-closed" class="text-3xl text-primary" />
            </div>
            <h2 class="text-lg font-semibold">管理员登录</h2>
          </div>

          <form class="space-y-4" @submit.prevent="handleLogin">
            <UFormField label="管理令牌" class="w-full">
              <UInput
                v-model="formData.token"
                type="password"
                placeholder="请输入管理令牌"
                icon="i-heroicons-key"
                :color="loginError ? 'error' : undefined"
                class="w-full"
              />
            </UFormField>

            <UAlert v-if="loginError" color="error" icon="i-heroicons-exclamation-circle">
              <template #description>{{ loginError }}</template>
            </UAlert>

            <UButton type="submit" size="lg" block :loading="logging">
              登录
            </UButton>
          </form>
        </div>
      </UCard>

      <!-- Footer -->
      <p class="text-center text-white/60 text-xs mt-6">
        Powered by EdgeOne Functions
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth';

definePageMeta({
  layout: 'auth',
});

const api = useApi();
const auth = useAuthStore();
const router = useRouter();
const toast = useToast();

const checking = ref(true);
const isInitialized = ref(false);
const initializing = ref(false);
const generatedToken = ref('');
const logging = ref(false);
const loginError = ref('');

const formData = reactive({
  token: '',
});

onMounted(async () => {
  auth.init();
  
  if (auth.isLoggedIn) {
    router.push('/');
    return;
  }

  const res = await api.getInitStatus();
  checking.value = false;
  
  if (res.code === 0 && res.data) {
    isInitialized.value = res.data.initialized;
  }
});

async function handleInit() {
  initializing.value = true;
  
  try {
    const res = await api.doInit();
    
    if (res.code === 0 && res.data?.adminToken) {
      generatedToken.value = res.data.adminToken;
      toast.add({ title: '初始化成功！', color: 'success' });
    } else {
      toast.add({ title: res.message || '初始化失败', color: 'error' });
    }
  } catch {
    toast.add({ title: '初始化失败，请重试', color: 'error' });
  } finally {
    initializing.value = false;
  }
}

async function copyToken() {
  await navigator.clipboard.writeText(generatedToken.value);
  toast.add({ title: '已复制到剪贴板', color: 'success' });
}

function confirmAndLogin() {
  auth.saveToken(generatedToken.value);
  router.push('/');
}

async function handleLogin() {
  if (!formData.token.trim()) {
    loginError.value = '请输入管理令牌';
    return;
  }

  logging.value = true;
  loginError.value = '';

  try {
    const success = await auth.login(formData.token);
    
    if (success) {
      toast.add({ title: '登录成功', color: 'success' });
      router.push('/');
    } else {
      loginError.value = '管理令牌无效，请检查后重试';
    }
  } catch {
    loginError.value = '登录失败，请重试';
  } finally {
    logging.value = false;
  }
}
</script>
