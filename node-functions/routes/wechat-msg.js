/**
 * WeChat Message Routes
 * Feature: frontend-admin-ui
 * 
 * Handles WeChat official account message callbacks:
 * - Server verification (GET)
 * - Message/Event handling (POST)
 * - Bind via text message: "绑定 SCTxxx" or "订阅 TPKxxx"
 */

import { configService } from '../services/config.js';
import { sendkeyService } from '../services/sendkey.js';
import { topicService } from '../services/topic.js';
import { openidService } from '../services/openid.js';
import { getUserInfo } from '../services/wechat.js';
import crypto from 'crypto';

/**
 * Register WeChat message routes
 * @param {import('@koa/router').default} router
 */
export function registerWeChatMsgRoutes(router) {
  /**
   * GET /wechat
   * WeChat server verification
   */
  router.get('/wechat', async (ctx) => {
    const { signature, timestamp, nonce, echostr } = ctx.query;

    const wechatConfig = await configService.getWeChatConfig();
    const token = wechatConfig?.msgToken || '';

    // Verify signature
    const arr = [token, timestamp, nonce].sort();
    const str = arr.join('');
    const hash = crypto.createHash('sha1').update(str).digest('hex');

    if (hash === signature) {
      ctx.body = echostr;
    } else {
      ctx.status = 403;
      ctx.body = 'Invalid signature';
    }
  });

  /**
   * POST /wechat
   * Handle WeChat messages and events
   */
  router.post('/wechat', async (ctx) => {
    const xml = ctx.request.body;
    
    // Parse XML (simple regex parsing for common fields)
    const msgType = extractXmlValue(xml, 'MsgType');
    const fromUser = extractXmlValue(xml, 'FromUserName');
    const toUser = extractXmlValue(xml, 'ToUserName');
    const content = extractXmlValue(xml, 'Content');
    const event = extractXmlValue(xml, 'Event');

    let replyContent = '';

    if (msgType === 'event') {
      // Handle events
      if (event === 'subscribe') {
        // User followed
        replyContent = await handleSubscribe(fromUser);
      } else if (event === 'unsubscribe') {
        // User unfollowed - no reply needed
        ctx.body = 'success';
        return;
      }
    } else if (msgType === 'text' && content) {
      // Handle text messages
      replyContent = await handleTextMessage(fromUser, content.trim());
    }

    if (replyContent) {
      ctx.type = 'application/xml';
      ctx.body = buildTextReply(toUser, fromUser, replyContent);
    } else {
      ctx.body = 'success';
    }
  });
}

/**
 * Handle subscribe event
 */
async function handleSubscribe(openId) {
  // Get user info and create OpenID record
  const userInfo = await getUserInfo(openId);
  
  let openIdRecord = await openidService.findByOpenId(openId);
  if (!openIdRecord) {
    await openidService.create(openId, userInfo?.nickname);
  } else if (userInfo?.nickname && !openIdRecord.name) {
    await openidService.update(openIdRecord.id, { name: userInfo.nickname });
  }

  return `欢迎关注！

您可以通过以下方式绑定消息推送：

1️⃣ 扫码绑定：在管理后台扫描 SendKey 或 Topic 的二维码

2️⃣ 消息绑定：
• 绑定 SendKey：发送 "绑定 SCTxxxxx"
• 订阅 Topic：发送 "订阅 TPKxxxxx"

绑定后即可接收消息推送通知。`;
}

/**
 * Handle text message for binding
 */
async function handleTextMessage(openId, content) {
  // Check for bind command: "绑定 SCTxxx" or "bind SCTxxx"
  const bindMatch = content.match(/^(绑定|bind)\s+(\S+)$/i);
  if (bindMatch) {
    const key = bindMatch[2];
    return await handleBindSendKey(openId, key);
  }

  // Check for subscribe command: "订阅 TPKxxx" or "subscribe TPKxxx"
  const subMatch = content.match(/^(订阅|subscribe)\s+(\S+)$/i);
  if (subMatch) {
    const key = subMatch[2];
    return await handleSubscribeTopic(openId, key);
  }

  // Check for unbind command: "解绑 SCTxxx" or "unbind SCTxxx"
  const unbindMatch = content.match(/^(解绑|unbind)\s+(\S+)$/i);
  if (unbindMatch) {
    const key = unbindMatch[2];
    return await handleUnbindSendKey(openId, key);
  }

  // Check for unsubscribe command: "退订 TPKxxx" or "unsubscribe TPKxxx"
  const unsubMatch = content.match(/^(退订|unsubscribe)\s+(\S+)$/i);
  if (unsubMatch) {
    const key = unsubMatch[2];
    return await handleUnsubscribeTopic(openId, key);
  }

  // Help message for unrecognized commands
  if (content.includes('帮助') || content.toLowerCase() === 'help') {
    return `📖 使用帮助

绑定 SendKey：
  发送 "绑定 SCTxxxxx"

订阅 Topic：
  发送 "订阅 TPKxxxxx"

解绑 SendKey：
  发送 "解绑 SCTxxxxx"

退订 Topic：
  发送 "退订 TPKxxxxx"`;
  }

  return null; // No reply for other messages
}

/**
 * Handle SendKey binding via message
 */
async function handleBindSendKey(openId, key) {
  // Find SendKey by key
  const sendKey = await sendkeyService.findByKey(key);
  if (!sendKey) {
    return `❌ 绑定失败

未找到 SendKey: ${key}
请检查 Key 是否正确。`;
  }

  // Get or create OpenID record
  const userInfo = await getUserInfo(openId);
  let openIdRecord = await openidService.findByOpenId(openId);
  if (!openIdRecord) {
    openIdRecord = await openidService.create(openId, userInfo?.nickname);
  }

  // Check if already bound
  if (sendKey.openIdRef === openIdRecord.id) {
    return `ℹ️ 您已绑定到 "${sendKey.name}"，无需重复绑定。`;
  }

  // Check if SendKey is bound to another user
  if (sendKey.openIdRef) {
    return `❌ 绑定失败

该 SendKey 已被其他用户绑定。
如需更换绑定，请联系管理员。`;
  }

  // Bind
  await sendkeyService.update(sendKey.id, { openIdRef: openIdRecord.id });

  return `✅ 绑定成功

您已成功绑定到 "${sendKey.name}"
现在可以接收消息推送了。`;
}

/**
 * Handle Topic subscription via message
 */
async function handleSubscribeTopic(openId, key) {
  // Find Topic by key
  const topic = await topicService.findByKey(key);
  if (!topic) {
    return `❌ 订阅失败

未找到 Topic: ${key}
请检查 Key 是否正确。`;
  }

  // Get or create OpenID record
  const userInfo = await getUserInfo(openId);
  let openIdRecord = await openidService.findByOpenId(openId);
  if (!openIdRecord) {
    openIdRecord = await openidService.create(openId, userInfo?.nickname);
  }

  // Check if already subscribed
  if (topic.subscriberRefs?.includes(openIdRecord.id)) {
    return `ℹ️ 您已订阅 "${topic.name}"，无需重复订阅。`;
  }

  // Subscribe
  await topicService.addSubscriber(topic.id, openIdRecord.id);

  return `✅ 订阅成功

您已成功订阅 "${topic.name}"
现在可以接收该主题的消息推送了。`;
}

/**
 * Handle SendKey unbinding via message
 */
async function handleUnbindSendKey(openId, key) {
  // Find SendKey by key
  const sendKey = await sendkeyService.findByKey(key);
  if (!sendKey) {
    return `❌ 解绑失败

未找到 SendKey: ${key}`;
  }

  // Get OpenID record
  const openIdRecord = await openidService.findByOpenId(openId);
  if (!openIdRecord || sendKey.openIdRef !== openIdRecord.id) {
    return `❌ 解绑失败

您未绑定到该 SendKey。`;
  }

  // Unbind
  await sendkeyService.update(sendKey.id, { openIdRef: null });

  return `✅ 解绑成功

您已从 "${sendKey.name}" 解绑。`;
}

/**
 * Handle Topic unsubscription via message
 */
async function handleUnsubscribeTopic(openId, key) {
  // Find Topic by key
  const topic = await topicService.findByKey(key);
  if (!topic) {
    return `❌ 退订失败

未找到 Topic: ${key}`;
  }

  // Get OpenID record
  const openIdRecord = await openidService.findByOpenId(openId);
  if (!openIdRecord || !topic.subscriberRefs?.includes(openIdRecord.id)) {
    return `❌ 退订失败

您未订阅该 Topic。`;
  }

  // Unsubscribe
  await topicService.removeSubscriber(topic.id, openIdRecord.id);

  return `✅ 退订成功

您已退订 "${topic.name}"。`;
}

/**
 * Extract value from XML string
 */
function extractXmlValue(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}><!\\[CDATA\\[(.+?)\\]\\]></${tag}>|<${tag}>(.+?)</${tag}>`));
  return match ? (match[1] || match[2]) : null;
}

/**
 * Build text reply XML
 */
function buildTextReply(toUser, fromUser, content) {
  return `<xml>
  <ToUserName><![CDATA[${toUser}]]></ToUserName>
  <FromUserName><![CDATA[${fromUser}]]></FromUserName>
  <CreateTime>${Math.floor(Date.now() / 1000)}</CreateTime>
  <MsgType><![CDATA[text]]></MsgType>
  <Content><![CDATA[${content}]]></Content>
</xml>`;
}
