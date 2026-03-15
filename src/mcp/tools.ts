import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

function textResult(data: unknown, isError = false) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }], isError };
}

/**
 * Registers all 8 SMS MCP tools on the given MCP server.
 * Each tool wraps a REST endpoint on the mock SMS gateway.
 */
export function registerTools(server: McpServer, baseUrl: string, apiKey?: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    headers['X-API-Key'] = apiKey;
  }

  async function apiFetch(
    path: string,
    options: { method?: string; body?: unknown; params?: Record<string, string> } = {},
  ) {
    const url = new URL(path, baseUrl);
    if (options.params) {
      for (const [k, v] of Object.entries(options.params)) {
        if (v !== undefined && v !== '') {
          url.searchParams.set(k, v);
        }
      }
    }
    try {
      const res = await fetch(url.toString(), {
        method: options.method ?? 'GET',
        headers,
        ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
      });
      const text = await res.text();
      let data: unknown;
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
      return { status: res.status, data };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        status: 0,
        data: { error: `Connection failed: ${message}. Is the mock SMS gateway running at ${baseUrl}?` },
      };
    }
  }

  async function resolvePhoneId(phone: string): Promise<string | undefined> {
    const { status, data } = await apiFetch('/api/v1/numbers');
    if (status !== 0 && Array.isArray(data)) {
      const match = (data as Array<{ id: string; number: string }>).find((n) => n.number === phone);
      return match?.id;
    }
    return undefined;
  }

  // 1. sms_send — POST /api/v1/send
  server.tool(
    'sms_send',
    'Send an SMS message to a phone number via the mock gateway.',
    {
      to: z.string().describe('Destination phone number (E.164 format, e.g. +40700000001)'),
      body: z.string().describe('Message body text'),
      from: z.string().optional().describe('Sender name/identifier'),
      template_key: z.string().optional().describe('Template key for categorizing the message'),
    },
    async ({ to, body, from, template_key }) => {
      const payload: Record<string, unknown> = { to, body };
      if (from) payload.from = from;
      if (template_key) payload.template_key = template_key;

      const { status, data } = await apiFetch('/api/v1/send', {
        method: 'POST',
        body: payload,
      });

      return textResult(data, status >= 400);
    },
  );

  // 2. sms_list — GET /api/v1/messages
  server.tool(
    'sms_list',
    'List SMS messages with optional filtering by phone, catch-all status, or body text search.',
    {
      phone: z.string().optional().describe('Phone number in E.164 format'),
      catch_all: z.boolean().optional().describe('If true, show only messages to unknown numbers'),
      q: z.string().optional().describe('Search messages by body text (substring match)'),
      limit: z.number().optional().describe('Max number of messages to return (default 50)'),
    },
    async ({ phone, catch_all, q, limit }) => {
      const params: Record<string, string> = {};
      if (phone) {
        const phoneId = await resolvePhoneId(phone);
        if (phoneId) params.phone_id = phoneId;
      }
      if (catch_all) params.catch_all = 'true';
      if (q) params.q = q;
      if (limit !== undefined) params.limit = String(limit);

      const { data } = await apiFetch('/api/v1/messages', { params });

      return textResult(data);
    },
  );

  // 3. sms_wait — Poll GET /api/v1/messages until a matching message arrives or timeout
  server.tool(
    'sms_wait',
    'Wait for an SMS message matching criteria to arrive. Polls the message list until a match is found or timeout. This is the key tool for E2E testing — send an action that triggers an SMS, then use sms_wait to verify it arrived.',
    {
      phone: z.string().describe('Phone number to wait for messages on (E.164 format)'),
      body_contains: z.string().optional().describe('Substring the message body must contain'),
      timeout_ms: z.number().default(10000).describe('How long to wait before giving up (ms, default 10000)'),
      poll_interval_ms: z.number().default(500).describe('How often to poll (ms, default 500)'),
    },
    async ({ phone, body_contains, timeout_ms, poll_interval_ms }) => {
      const deadline = Date.now() + timeout_ms;

      const phoneId = await resolvePhoneId(phone);

      while (Date.now() < deadline) {
        const params: Record<string, string> = { limit: '100' };
        if (phoneId) params.phone_id = phoneId;
        if (body_contains) params.q = body_contains;

        const { status, data } = await apiFetch('/api/v1/messages', { params });

        if (status >= 400 || status === 0) {
          return textResult({ found: false, error: `API error (status ${status})`, details: data }, true);
        }

        const result = data as { data?: Array<{ phone_number?: string; body?: string; direction?: string }> };
        if (result.data && Array.isArray(result.data)) {
          const match = result.data.find((msg) => {
            if (msg.phone_number !== phone) return false;
            if (body_contains && !msg.body?.includes(body_contains)) return false;
            return true;
          });

          if (match) {
            return textResult({ found: true, message: match });
          }
        }

        // Wait before polling again
        await new Promise((resolve) => setTimeout(resolve, poll_interval_ms));
      }

      return textResult(
        {
          found: false,
          error: `No matching message found within ${timeout_ms}ms for phone ${phone}${body_contains ? ` containing "${body_contains}"` : ''}`,
        },
        true,
      );
    },
  );

  // 4. sms_reply — POST /api/v1/reply
  server.tool(
    'sms_reply',
    'Simulate an inbound SMS reply from a phone number. Triggers webhook if configured.',
    {
      from: z.string().describe('Phone number sending the reply (E.164 format)'),
      body: z.string().describe('Reply message body text'),
    },
    async ({ from, body }) => {
      const { status, data } = await apiFetch('/api/v1/reply', {
        method: 'POST',
        body: { from, body },
      });

      return textResult(data, status >= 400);
    },
  );

  // 5. sms_create_number — POST /api/v1/numbers
  server.tool(
    'sms_create_number',
    'Register a phone number in the mock gateway with optional delivery behavior configuration.',
    {
      number: z.string().describe('Phone number in E.164 format (e.g. +40712345678)'),
      label: z.string().optional().describe('Human-readable label for this number'),
      behavior: z
        .string()
        .optional()
        .describe('Delivery behavior: deliver, fail, delay, reject, rate_limit, or timeout'),
      behavior_config: z
        .record(z.string(), z.unknown())
        .optional()
        .describe(
          'Behavior configuration object (e.g. { "delay_ms": 3000 } for delay, { "max_messages": 5, "window_seconds": 3600 } for rate_limit)',
        ),
    },
    async ({ number, label, behavior, behavior_config }) => {
      const payload: Record<string, unknown> = { number };
      if (label) payload.label = label;
      if (behavior) payload.behavior = behavior;
      if (behavior_config) payload.behavior_config = behavior_config;

      const { status, data } = await apiFetch('/api/v1/numbers', {
        method: 'POST',
        body: payload,
      });

      return textResult(data, status >= 400);
    },
  );

  // 6. sms_delete_number — DELETE /api/v1/numbers/:id
  server.tool(
    'sms_delete_number',
    'Delete a phone number from the mock gateway by its ID.',
    {
      id: z.string().describe('Phone number ID (UUID) to delete'),
    },
    async ({ id }) => {
      const { status } = await apiFetch(`/api/v1/numbers/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });

      if (status === 204) {
        return textResult({ success: true, deleted: id });
      }

      return textResult({ success: false, status }, true);
    },
  );

  // 7. sms_clear — DELETE /api/v1/messages or POST /api/v1/reset
  server.tool(
    'sms_clear',
    'Clear messages from the mock gateway. Optionally clear only messages for a specific phone, or reset everything (numbers, messages, rate limits) back to initial state.',
    {
      phone_id: z.string().optional().describe('If provided, only clear messages for this phone ID'),
      reset: z.boolean().optional().describe('If true, reset everything (re-seeds magic numbers, clears rate limits)'),
    },
    async ({ phone_id, reset }) => {
      if (reset) {
        const { status, data } = await apiFetch('/api/v1/reset', { method: 'POST' });
        return textResult(data, status >= 400);
      }

      const params: Record<string, string> = {};
      if (phone_id) params.phone_id = phone_id;

      const { status } = await apiFetch('/api/v1/messages', {
        method: 'DELETE',
        params,
      });

      return textResult({ success: status === 204, cleared: phone_id ?? 'all' }, status >= 400);
    },
  );

  // 8. sms_stats — GET /api/v1/stats
  server.tool(
    'sms_stats',
    'Get aggregate message statistics from the mock SMS gateway (counts by status, direction, catch-all).',
    {},
    async () => {
      const { data } = await apiFetch('/api/v1/stats');

      return textResult(data);
    },
  );
}
