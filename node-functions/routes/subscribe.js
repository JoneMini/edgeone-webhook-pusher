/**
 * Subscribe Routes - Topic Subscription via WeChat OAuth
 * Feature: frontend-admin-ui
 * 
 * Handles QR code scanning flow for subscribing WeChat users to Topics.
 * Checks follow status before allowing subscription.
 * Returns JSON responses for API consumers.
 */

import { configKV } from '../services/kv-client.js';
import { configService } from '../services/config.js';
import { topicService } from '../services/topic.js';
import { openidService } from '../services/openid.js';
import { generateId, now } from '../shared/utils.js';
import { checkUserFollowStatus } from '../services/wechat.js';
import { ErrorCodes, errorResponse, successResponse } from '../shared/error-codes.js';

// OAuth state TTL: 5 minutes
const OAUTH_STATE_TTL = 300;

/**
 * Register subscribe routes
 * @param {import('@koa/router').default} router
 */
export function registerSubscribeRoutes(router) {
  /**
   * GET /subscribe/:topicId
   * Entry point for Topic subscription - redirects to WeChat OAuth
   */
  router.get('/subscribe/:topicId', async (ctx) => {
    const { topicId } = ctx.params;

    // Verify Topic exists
    const topic = await topicService.get(topicId);
    if (!topic) {
      ctx.status = 404;
      ctx.body = errorResponse(ErrorCodes.TOPIC_NOT_FOUND);
      return;
    }

    // Get WeChat config
    const wechatConfig = await configService.getWeChatConfig();
    if (!wechatConfig?.appId) {
      ctx.status = 500;
      ctx.body = errorResponse(ErrorCodes.CONFIG_ERROR, '微信公众号未配置');
      return;
    }

    // Generate OAuth state
    const state = generateId();
    const stateData = {
      type: 'subscribe',
      topicId,
      createdAt: now(),
    };

    // Store state in KV with TTL
    await configKV.put(`oauth_state:${state}`, stateData, OAUTH_STATE_TTL);

    // Build WeChat OAuth URL - use snsapi_userinfo to get user info
    const redirectUri = encodeURIComponent(`${getOrigin(ctx)}/v1/subscribe/${topicId}/callback`);
    const oauthUrl = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${wechatConfig.appId}&redirect_uri=${redirectUri}&response_type=code&scope=snsapi_userinfo&state=${state}#wechat_redirect`;

    ctx.redirect(oauthUrl);
  });

  /**
   * GET /subscribe/:topicId/callback
   * WeChat OAuth callback - completes the subscription after checking follow status
   */
  router.get('/subscribe/:topicId/callback', async (ctx) => {
    const { topicId } = ctx.params;
    const { code, state } = ctx.query;

    // Validate state
    if (!state) {
      ctx.status = 400;
      ctx.body = errorResponse(ErrorCodes.INVALID_STATE);
      return;
    }

    // Get and validate state from KV
    const stateData = await configKV.get(`oauth_state:${state}`);
    if (!stateData || stateData.type !== 'subscribe' || stateData.topicId !== topicId) {
      ctx.status = 400;
      ctx.body = errorResponse(ErrorCodes.STATE_EXPIRED, '链接已过期或无效，请重新扫码');
      return;
    }

    // Delete used state
    await configKV.delete(`oauth_state:${state}`);

    // Verify Topic still exists
    const topic = await topicService.get(topicId);
    if (!topic) {
      ctx.status = 404;
      ctx.body = errorResponse(ErrorCodes.TOPIC_NOT_FOUND);
      return;
    }

    // Get WeChat config
    const wechatConfig = await configService.getWeChatConfig();
    if (!wechatConfig?.appId || !wechatConfig?.appSecret) {
      ctx.status = 500;
      ctx.body = errorResponse(ErrorCodes.CONFIG_ERROR);
      return;
    }

    try {
      // Exchange code for access token and openid
      const tokenUrl = `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${wechatConfig.appId}&secret=${wechatConfig.appSecret}&code=${code}&grant_type=authorization_code`;
      const tokenRes = await fetch(tokenUrl);
      const tokenData = await tokenRes.json();

      if (tokenData.errcode) {
        console.error('WeChat OAuth error:', tokenData);
        ctx.status = 400;
        ctx.body = errorResponse(ErrorCodes.OAUTH_FAILED, '微信授权失败，请重试', tokenData.errmsg);
        return;
      }

      const { openid, access_token: oauthAccessToken } = tokenData;

      // Check if user has followed the official account
      const followStatus = await checkUserFollowStatus(openid);
      if (!followStatus.subscribed) {
        ctx.status = 400;
        ctx.body = errorResponse(ErrorCodes.NOT_FOLLOWED);
        return;
      }

      // Get user info from OAuth (for nickname)
      let nickname = null;
      try {
        const userInfoUrl = `https://api.weixin.qq.com/sns/userinfo?access_token=${oauthAccessToken}&openid=${openid}&lang=zh_CN`;
        const userInfoRes = await fetch(userInfoUrl);
        const userInfo = await userInfoRes.json();
        if (!userInfo.errcode && userInfo.nickname) {
          nickname = userInfo.nickname;
        }
      } catch (e) {
        console.warn('Failed to get user info:', e);
      }

      // Find or create OpenID record
      let openIdRecord = await openidService.findByOpenId(openid);
      if (!openIdRecord) {
        openIdRecord = await openidService.create(openid, nickname);
      } else if (nickname && !openIdRecord.name) {
        await openidService.update(openIdRecord.id, { name: nickname });
        openIdRecord.name = nickname;
      }

      // Check if already subscribed
      if (topic.subscriberRefs?.includes(openIdRecord.id)) {
        ctx.body = successResponse({
          topicId,
          topicName: topic.name,
          openIdRef: openIdRecord.id,
        }, '您已订阅该 Topic');
        return;
      }

      // Add subscriber to Topic
      await topicService.subscribe(topicId, openIdRecord.id);

      // Return success
      ctx.body = successResponse({
        topicId,
        topicName: topic.name,
        openIdRef: openIdRecord.id,
        nickname: openIdRecord.name || null,
      }, '订阅成功');
    } catch (error) {
      console.error('Subscribe callback error:', error);
      ctx.status = 500;
      ctx.body = errorResponse(ErrorCodes.SERVER_ERROR);
    }
  });
}

/**
 * Get origin from context
 */
function getOrigin(ctx) {
  const proto = ctx.get('x-forwarded-proto') || ctx.protocol;
  const host = ctx.get('x-forwarded-host') || ctx.host;
  return `${proto}://${host}`;
}
