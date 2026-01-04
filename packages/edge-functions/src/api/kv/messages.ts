// Edge Function: Messages KV Operations
// Path: /api/kv/messages

interface KVNamespace {
  get(key: string, type: 'json'): Promise<unknown>;
  get(key: string, type?: 'text'): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{
    keys: { name: string }[];
    list_complete: boolean;
    cursor?: string;
  }>;
}

interface EdgeContext {
  request: Request;
  params: Record<string, string>;
  env: {
    MESSAGES_KV: KVNamespace;
  };
}

export async function onRequest({ request, env }: EdgeContext): Promise<Response> {
  const url = new URL(request.url);
  const action = url.searchParams.get('action');

  try {
    switch (action) {
      case 'get': {
        const key = url.searchParams.get('key');
        if (!key) {
          return createJsonResponse(400, { success: false, error: 'Missing key parameter' });
        }
        const data = await env.MESSAGES_KV.get(key, 'json');
        return createJsonResponse(200, { success: true, data });
      }

      case 'put': {
        if (request.method !== 'POST') {
          return createJsonResponse(405, { success: false, error: 'PUT requires POST method' });
        }
        const body = (await request.json()) as { key: string; value: unknown; ttl?: number };
        if (!body.key) {
          return createJsonResponse(400, { success: false, error: 'Missing key in body' });
        }
        await env.MESSAGES_KV.put(
          body.key,
          JSON.stringify(body.value),
          body.ttl ? { expirationTtl: body.ttl } : undefined
        );
        return createJsonResponse(200, { success: true });
      }

      case 'delete': {
        const key = url.searchParams.get('key');
        if (!key) {
          return createJsonResponse(400, { success: false, error: 'Missing key parameter' });
        }
        await env.MESSAGES_KV.delete(key);
        return createJsonResponse(200, { success: true });
      }

      case 'list': {
        const prefix = url.searchParams.get('prefix') || '';
        const limit = parseInt(url.searchParams.get('limit') || '256', 10);
        const cursor = url.searchParams.get('cursor') || undefined;
        const result = await env.MESSAGES_KV.list({ prefix, limit, cursor });
        return createJsonResponse(200, {
          success: true,
          keys: result.keys.map((k) => k.name),
          complete: result.list_complete,
          cursor: result.cursor,
        });
      }

      default:
        return createJsonResponse(400, {
          success: false,
          error: 'Invalid action. Use: get, put, delete, list',
        });
    }
  } catch (error) {
    return createJsonResponse(500, { success: false, error: String(error) });
  }
}

function createJsonResponse(status: number, data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
