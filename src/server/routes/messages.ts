import { Hono } from 'hono';
import type { AppEnv } from '../context.js';
import { getMessages, getMessageById, clearMessages } from '../db/queries.js';
import type { Direction, MessageStatus } from '../db/queries.js';

const messages = new Hono<AppEnv>();

// GET /api/v1/messages — list messages with filters and pagination
messages.get('/', (c) => {
  const { db } = c.get('ctx');

  const phoneId = c.req.query('phone_id');
  const catchAll = c.req.query('catch_all') === 'true';
  const q = c.req.query('q');
  const direction = c.req.query('direction') as Direction | undefined;
  const status = c.req.query('status') as MessageStatus | undefined;

  let limit: number | undefined;
  let offset: number | undefined;

  if (c.req.query('limit') !== undefined) {
    limit = parseInt(c.req.query('limit')!, 10);
    if (Number.isNaN(limit) || limit < 0) {
      return c.json({ error: 'limit must be a valid non-negative integer' }, 400);
    }
    limit = Math.min(limit, 500);
  }

  if (c.req.query('offset') !== undefined) {
    offset = parseInt(c.req.query('offset')!, 10);
    if (Number.isNaN(offset) || offset < 0) {
      return c.json({ error: 'offset must be a valid non-negative integer' }, 400);
    }
  }

  const result = getMessages(db, {
    phone_id: phoneId,
    catch_all: catchAll || undefined,
    q,
    direction,
    status,
    limit,
    offset,
  });

  return c.json(result);
});

// GET /api/v1/messages/:id — get single message
messages.get('/:id', (c) => {
  const { db } = c.get('ctx');
  const id = c.req.param('id');

  const msg = getMessageById(db, id);
  if (!msg) {
    return c.json({ error: 'Message not found' }, 404);
  }

  return c.json(msg);
});

// DELETE /api/v1/messages — clear messages
messages.delete('/', (c) => {
  const { db, broadcast } = c.get('ctx');
  const phoneId = c.req.query('phone_id');

  clearMessages(db, phoneId);

  broadcast({ type: 'messages:cleared', data: { phone_id: phoneId ?? null } });

  return c.body(null, 204);
});

export default messages;
