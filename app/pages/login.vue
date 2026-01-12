<template>
  <div class="login-page">
    <div class="login-container">
      <div class="login-header">
        <Icon icon="mdi:webhook" class="logo-icon" />
        <h1>EdgeOne Webhook Pusher</h1>
        <p class="subtitle">消息推送服务管理后台</p>
      </div>

      <t-loading :loading="checking" text="检查初始化状态...">
        <!-- 初始化模式 -->
        <t-card v-if="!isInitialized && !checking" :bordered="false" class="login-card">
          <template v-if="!generatedToken">
            <div class="init-section">
              <Icon icon="mdi:rocket-launch" class="init-icon" />
              <h2>首次使用</h2>
              <p>系统尚未初始化，点击下方按钮开始初始化并生成管理令牌。</p>
              <t-button
                theme="primary"
                size="large"
                :loading="initializing"
                @click="handleInit"
              >
                <template #icon><Icon icon="mdi:play" /></template>
                开始初始化
              </t-button>
            </div>
          </template>

          <template v-else>
            <div class="token-section">
              <Icon icon="mdi:check-circle" class="success-icon" />
              <h2>初始化成功</h2>
              <p class="warning-text">
                <Icon icon="mdi:alert" />
                请妥善保存以下管理令牌，它是访问管理后台的唯一凭证，丢失后无法找回！
              </p>
              <t-input
                v-model="generatedToken"
                readonly
                size="large"
                class="token-input"
              >
                <template #suffix>
                  <t-button
                    theme="default"
                    variant="text"
                    @click="copyToken"
                  >
                    <Icon icon="mdi:content-copy" />
                  </t-button>
                </template>
              </t-input>
              <t-button
                theme="primary"
                size="large"
                block
                @click="confirmAndLogin"
              >
                我已保存，进入管理后台
              </t-button>
            </div>
          </template>
        </t-card>

        <!-- 登录模式 -->
        <t-card v-if="isInitialized && !checking" :bordered="false" class="login-card">
          <div class="login-section">
            <Icon icon="mdi:lock" class="login-icon" />
            <h2>管理员登录</h2>
            <t-form ref="formRef" :data="formData" :rules="formRules" @submit="handleLogin">
              <t-form-item name="token">
                <t-input
                  v-model="formData.token"
                  type="password"
                  size="large"
                  placeholder="请输入管理令牌 (Admin Token)"
                  :status="loginError ? 'error' : 'default'"
                  clearable
                >
                  <template #prefix-icon>
                    <Icon icon="mdi:key" />
                  </template>
                </t-input>
              </t-form-item>
              <t-form-item v-if="loginError">
                <t-alert theme="error" :message="loginError" />
              </t-form-item>
              <t-form-item>
                <t-button
                  theme="primary"
                  size="large"
                  type="submit"
                  block
                  :loading="logging"
                >
                  登录
                </t-button>
              </t-form-item>
            </t-form>
          </div>
        </t-card>
      </t-loading>
    </div>
  </div>
</template>

<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next';
import { useAuthStore } from '~/stores/auth';

definePageMeta({
  layout: 'auth',
});

const api = useApi();
const auth = useAuthStore();
const router = useRouter();

const checking = ref(true);
const isInitialized = ref(false);
const initializing = ref(false);
const generatedToken = ref('');
const logging = ref(false);
const loginError = ref('');
const formRef = ref();

const formData = reactive({
  token: '',
});

const formRules = {
  token: [{ required: true, message: '请输入管理令牌' }],
};

// Check if already logged in
onMounted(async () => {
  auth.init();
  
  if (auth.isLoggedIn) {
    router.push('/');
    return;
  }

  // Check initialization status
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
      MessagePlugin.success('初始化成功！');
    } else {
      MessagePlugin.error(res.message || '初始化失败');
    }
  } catch (e) {
    MessagePlugin.error('初始化失败，请重试');
  } finally {
    initializing.value = false;
  }
}

async function copyToken() {
  await navigator.clipboard.writeText(generatedToken.value);
  MessagePlugin.success('已复制到剪贴板');
}

function confirmAndLogin() {
  auth.saveToken(generatedToken.value);
  router.push('/');
}

async function handleLogin() {
  const valid = await formRef.value?.validate();
  if (valid !== true) return;

  logging.value = true;
  loginError.value = '';

  try {
    const success = await auth.login(formData.token);
    
    if (success) {
      MessagePlugin.success('登录成功');
      router.push('/');
    } else {
      loginError.value = '管理令牌无效，请检查后重试';
    }
  } catch (e) {
    loginError.value = '登录失败，请重试';
  } finally {
    logging.value = false;
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.login-container {
  width: 100%;
  max-width: 420px;
}

.login-header {
  text-align: center;
  color: white;
  margin-bottom: 24px;
}

.logo-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.login-header h1 {
  margin: 0 0 8px;
  font-size: 24px;
  font-weight: 600;
}

.login-header .subtitle {
  margin: 0;
  opacity: 0.9;
  font-size: 14px;
}

.login-card {
  border-radius: 12px;
}

.init-section,
.token-section,
.login-section {
  text-align: center;
  padding: 20px 0;
}

.init-icon,
.success-icon,
.login-icon {
  font-size: 48px;
  color: var(--td-brand-color);
  margin-bottom: 16px;
}

.success-icon {
  color: var(--td-success-color);
}

.init-section h2,
.token-section h2,
.login-section h2 {
  margin: 0 0 12px;
  font-size: 20px;
}

.init-section p,
.token-section p {
  color: var(--td-text-color-secondary);
  margin: 0 0 24px;
  line-height: 1.6;
}

.warning-text {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  text-align: left;
  color: var(--td-warning-color) !important;
  background: var(--td-warning-color-1);
  padding: 12px;
  border-radius: 6px;
}

.token-input {
  margin-bottom: 16px;
}

.login-section {
  text-align: left;
}

.login-section h2 {
  text-align: center;
}
</style>
