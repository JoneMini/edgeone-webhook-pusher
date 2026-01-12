<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { MessagePlugin } from 'tdesign-vue-next';
import type { AppConfig } from '~/composables/useApi';

definePageMeta({
  layout: 'default',
});

const api = useApi();

// State
const loading = ref(true);
const saving = ref(false);
const config = ref<AppConfig | null>(null);

// Form data
const formData = reactive({
  wechat: {
    appId: '',
    appSecret: '',
    templateId: '',
    msgToken: '',
  },
  rateLimit: {
    perMinute: 5,
  },
  retention: {
    days: 30,
  },
});

// Load config
async function loadConfig() {
  loading.value = true;
  try {
    const res = await api.getConfig();
    if (res.data) {
      config.value = res.data;
      // Fill form with config values
      formData.wechat.appId = res.data.wechat?.appId || '';
      formData.wechat.appSecret = ''; // Don't show masked secret
      formData.wechat.templateId = res.data.wechat?.templateId || '';
      formData.wechat.msgToken = res.data.wechat?.msgToken || '';
      formData.rateLimit.perMinute = res.data.rateLimit?.perMinute || 5;
      formData.retention.days = res.data.retention?.days || 30;
    }
  } catch (e: any) {
    MessagePlugin.error(e.message || '获取配置失败');
  } finally {
    loading.value = false;
  }
}

// Save config
async function handleSave() {
  saving.value = true;
  try {
    const updateData: any = {
      rateLimit: formData.rateLimit,
      retention: formData.retention,
    };

    // Only include wechat fields that have values
    const wechatUpdate: any = {};
    if (formData.wechat.appId) wechatUpdate.appId = formData.wechat.appId;
    if (formData.wechat.appSecret) wechatUpdate.appSecret = formData.wechat.appSecret;
    if (formData.wechat.templateId) wechatUpdate.templateId = formData.wechat.templateId;
    if (formData.wechat.msgToken) wechatUpdate.msgToken = formData.wechat.msgToken;
    
    if (Object.keys(wechatUpdate).length > 0) {
      updateData.wechat = wechatUpdate;
    }

    await api.updateConfig(updateData);
    MessagePlugin.success('配置已保存');
    await loadConfig();
  } catch (e: any) {
    MessagePlugin.error(e.message || '保存失败');
  } finally {
    saving.value = false;
  }
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

onMounted(loadConfig);
</script>

<template>
  <div class="settings-page">
    <div class="page-header">
      <h1>系统设置</h1>
    </div>

    <t-loading :loading="loading">
      <div class="settings-content">
        <!-- WeChat Config -->
        <t-card title="微信公众号配置" class="config-card">
          <template #actions>
            <t-tag v-if="config?.wechat?.appId" theme="success" size="small">
              <Icon icon="mdi:check" />
              已配置
            </t-tag>
            <t-tag v-else theme="warning" size="small">
              <Icon icon="mdi:alert" />
              未配置
            </t-tag>
          </template>

          <t-form label-width="120px">
            <t-form-item label="AppID">
              <t-input
                v-model="formData.wechat.appId"
                placeholder="请输入微信公众号 AppID"
              />
            </t-form-item>
            <t-form-item label="AppSecret">
              <t-input
                v-model="formData.wechat.appSecret"
                type="password"
                :placeholder="config?.wechat?.appSecret ? '已设置，留空保持不变' : '请输入微信公众号 AppSecret'"
              />
            </t-form-item>
            <t-form-item label="模板ID">
              <t-input
                v-model="formData.wechat.templateId"
                placeholder="请输入消息模板 ID"
              />
            </t-form-item>
            <t-form-item label="消息Token">
              <t-input
                v-model="formData.wechat.msgToken"
                placeholder="请输入服务器配置 Token"
              />
              <span class="form-tip">用于接收公众号消息（绑定指令）</span>
            </t-form-item>
          </t-form>
        </t-card>

        <!-- Rate Limit Config -->
        <t-card title="速率限制" class="config-card">
          <t-form label-width="120px">
            <t-form-item label="每分钟限制">
              <t-input-number
                v-model="formData.rateLimit.perMinute"
                :min="1"
                :max="100"
                theme="normal"
              />
              <span class="form-tip">每个 SendKey/Topic 每分钟最多发送的消息数</span>
            </t-form-item>
          </t-form>
        </t-card>

        <!-- Retention Config -->
        <t-card title="数据保留" class="config-card">
          <t-form label-width="120px">
            <t-form-item label="保留天数">
              <t-input-number
                v-model="formData.retention.days"
                :min="1"
                :max="365"
                theme="normal"
              />
              <span class="form-tip">消息历史记录保留天数</span>
            </t-form-item>
          </t-form>
        </t-card>

        <!-- Save Button -->
        <div class="save-bar">
          <t-button theme="primary" :loading="saving" @click="handleSave">
            <template #icon><Icon icon="mdi:content-save" /></template>
            保存配置
          </t-button>
        </div>

        <!-- Help Section -->
        <t-card title="配置帮助" class="help-card">
          <t-collapse>
            <t-collapse-panel header="如何获取微信公众号 AppID 和 AppSecret？">
              <ol>
                <li>登录 <a href="https://mp.weixin.qq.com" target="_blank" rel="noopener">微信公众平台</a></li>
                <li>进入「设置与开发」-「基本配置」</li>
                <li>在「公众号开发信息」中查看 AppID</li>
                <li>点击「重置」获取 AppSecret（请妥善保管）</li>
              </ol>
            </t-collapse-panel>
            <t-collapse-panel header="如何创建消息模板？">
              <ol>
                <li>在微信公众平台进入「功能」-「模板消息」</li>
                <li>从模板库中选择或创建新模板</li>
                <li>复制模板 ID 填入上方配置</li>
                <li>模板内容建议包含 <code v-pre>{{title.DATA}}</code> 和 <code v-pre>{{content.DATA}}</code> 字段</li>
              </ol>
            </t-collapse-panel>
            <t-collapse-panel header="如何配置网页授权域名？">
              <ol>
                <li>在微信公众平台进入「设置与开发」-「公众号设置」</li>
                <li>选择「功能设置」标签页</li>
                <li>在「网页授权域名」中添加您的域名</li>
                <li>下载验证文件并上传到网站根目录</li>
              </ol>
              <t-alert theme="info" style="margin-top: 12px">
                <template #message>
                  网页授权域名用于扫码绑定功能，请确保已正确配置。
                </template>
              </t-alert>
            </t-collapse-panel>
            <t-collapse-panel header="如何配置服务器消息接收？">
              <ol>
                <li>在微信公众平台进入「设置与开发」-「基本配置」</li>
                <li>在「服务器配置」中点击「修改配置」</li>
                <li>URL 填写：<code>https://您的域名/v1/wechat</code></li>
                <li>Token 填写一个自定义字符串，并同步填入上方「消息Token」</li>
                <li>EncodingAESKey 随机生成即可</li>
                <li>消息加解密方式选择「明文模式」</li>
                <li>点击「启用」完成配置</li>
              </ol>
              <t-alert theme="info" style="margin-top: 12px">
                <template #message>
                  配置后用户可在公众号内发送「绑定 SCTxxx」或「订阅 TPKxxx」完成绑定。
                </template>
              </t-alert>
            </t-collapse-panel>
          </t-collapse>
        </t-card>
      </div>
    </t-loading>
  </div>
</template>

<style scoped>
.settings-page {
  padding: 24px;
}

.page-header {
  margin-bottom: 24px;
}

.page-header h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
}

.settings-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-width: 800px;
}

.config-card {
  margin-bottom: 0;
}

.form-tip {
  margin-left: 12px;
  font-size: 13px;
  color: var(--td-text-color-secondary);
}

.save-bar {
  display: flex;
  justify-content: flex-end;
}

.help-card ol {
  margin: 0;
  padding-left: 20px;
  line-height: 2;
}

.help-card a {
  color: var(--td-brand-color);
}

.help-card code {
  background: var(--td-bg-color-secondarycontainer);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 13px;
}
</style>
