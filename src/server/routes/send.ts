import { Hono } from 'hono';
import type { AppEnv } from '../context.js';
import { getPhoneNumberByNumber, createMessage } from '../db/queries.js';
import { applyBehavior } from '../behaviors.js';

const send = new Hono<AppEnv>();

const E164_REGEX = /^\+[1-9]\d{6,14}$/;

send.post('/', async (c) => {
  const ctx = c.get('ctx');
  const { db, rateLimiter, broadcast } = ctx;

  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  const to = body.to as string | undefined;
  const messageBody = body.body as string | undefined;
  const from = body.from as string | undefined;
  const templateKey = body.template_key as string | undefined;
  const metadata = body.metadata as Record<string, unknown> | undefined;

  if (!to) {
    return c.json({ error: 'Missing required field: to' }, 400);
  }
  if (!E164_REGEX.test(to)) {
    return c.json({ error: 'Invalid phone number format. Expected E.164 (e.g. +40712345678)' }, 400);
  }
  if (!messageBody) {
    return c.json({ error: 'Missing required field: body' }, 400);
  }

  // Look up the phone number to determine behavior
  const phone = getPhoneNumberByNumber(db, to);
  const behavior = phone?.behavior ?? 'deliver';
  const behaviorConfig = phone?.behavior_config ?? null;

  // Check rate limit if applicable
  if (behavior === 'rate_limit' && behaviorConfig) {
    const maxMessages = (behaviorConfig.max_messages as number) ?? 5;
    const windowSeconds = (behaviorConfig.window_seconds as number) ?? 3600;

    if (!rateLimiter.check(to, maxMessages, windowSeconds)) {
      // Create a failed message record
      const msg = createMessage(db, {
        phone_number: to,
        direction: 'outbound',
        body: messageBody,
        from_name: from,
        template_key: templateKey,
        status: 'failed',
        error_message: 'Rate limit exceeded',
        metadata,
      });

      broadcast({ type: 'message:new', data: msg });

      return c.json({
        success: false,
        message_id: msg.id,
        status: 'failed',
        error: 'Rate limit exceeded',
        to,
      }, 429);
    }

    // Record the send for rate limiting
    rateLimiter.record(to, windowSeconds);
  }

  // Apply behavior
  const result = await applyBehavior(behavior, behaviorConfig);

  // Handle timeout - drop connection without responding
  if (result.timeout) {
    const msg = createMessage(db, {
      phone_number: to,
      direction: 'outbound',
      body: messageBody,
      from_name: from,
      template_key: templateKey,
      status: 'failed',
      error_message: result.error,
      metadata,
    });

    broadcast({ type: 'message:new', data: msg });

    return c.json({
      success: false,
      message_id: msg.id,
      status: 'failed',
      error: result.error,
      to,
    }, 504);
  }

  // Create message record
  const msg = createMessage(db, {
    phone_number: to,
    direction: 'outbound',
    body: messageBody,
    from_name: from,
    template_key: templateKey,
    status: result.status,
    error_message: result.error,
    metadata,
  });

  broadcast({ type: 'message:new', data: msg });

  const httpStatus = result.httpStatus ?? 200;

  return c.json({
    success: result.success,
    message_id: msg.id,
    status: result.status,
    ...(result.error ? { error: result.error } : {}),
    to,
  }, httpStatus as 200);
});

export default send;
