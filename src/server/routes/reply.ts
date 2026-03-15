import { Hono } from 'hono';
import type { AppEnv } from '../context.js';
import { createMessage, updateMessageWebhookStatus } from '../db/queries.js';
import { dispatchWebhook } from '../webhook.js';

const reply = new Hono<AppEnv>();

// POST /api/v1/reply — simulate a reply from a phone number
reply.post('/', async (c) => {
  const { db, broadcast } = c.get('ctx');

  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  const from = body.from as string | undefined;
  const messageBody = body.body as string | undefined;
  const webhookUrlOverride = body.webhook_url as string | undefined;

  if (!from) {
    return c.json({ error: 'Missing required field: from' }, 400);
  }
  if (!messageBody) {
    return c.json({ error: 'Missing required field: body' }, 400);
  }

  // Create inbound message
  const msg = createMessage(db, {
    phone_number: from,
    direction: 'inbound',
    body: messageBody,
    status: 'delivered',
  });

  broadcast({ type: 'message:new', data: msg });

  // Determine webhook URL: per-request (only if allowed hosts configured) > DB settings > env
  const allowedHosts = process.env.WEBHOOK_ALLOWED_HOSTS;
  let webhookUrl = (allowedHosts && webhookUrlOverride) ? webhookUrlOverride : undefined;
  let webhookError: string | undefined;

  if (!webhookUrl) {
    // Check DB settings
    const settingsRow = db.prepare(
      "SELECT value FROM settings WHERE key = 'webhook_url'"
    ).get() as { value: string } | undefined;
    if (settingsRow) {
      try {
        webhookUrl = JSON.parse(settingsRow.value) as string;
      } catch {
        console.warn('Malformed webhook_url in settings:', settingsRow.value);
        webhookError = 'Malformed webhook_url in settings';
      }
    }
  }

  if (!webhookUrl) {
    webhookUrl = process.env.WEBHOOK_URL;
  }

  // Dispatch webhook if URL is configured
  if (webhookUrl) {
    const result = await dispatchWebhook(
      webhookUrl,
      {
        from,
        body: messageBody,
        message_id: msg.id,
        timestamp: msg.created_at,
      },
      allowedHosts,
    );

    const webhookStatus = result.success ? 'sent' : 'failed';
    updateMessageWebhookStatus(db, msg.id, webhookStatus);

    return c.json({
      success: true,
      message_id: msg.id,
      webhook_status: webhookStatus,
      ...(result.error ? { webhook_error: result.error } : {}),
      ...(webhookError ? { webhook_error: webhookError } : {}),
    });
  }

  return c.json({
    success: true,
    message_id: msg.id,
    webhook_status: null,
    ...(webhookError ? { webhook_error: webhookError } : {}),
  });
});

export default reply;
