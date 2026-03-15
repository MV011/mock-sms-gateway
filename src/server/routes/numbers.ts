import { Hono } from 'hono';
import type { AppEnv } from '../context.js';
import {
  createPhoneNumber,
  getPhoneNumbers,
  getPhoneNumberById,
  getPhoneNumberByNumber,
  updatePhoneNumber,
  deletePhoneNumber,
} from '../db/queries.js';

const numbers = new Hono<AppEnv>();

// Country code to E.164 prefix mapping
const COUNTRY_PREFIXES: Record<string, { prefix: string; length: number }> = {
  RO: { prefix: '+407', length: 8 },
  US: { prefix: '+1', length: 10 },
  GB: { prefix: '+44', length: 10 },
  DE: { prefix: '+49', length: 10 },
  FR: { prefix: '+33', length: 9 },
};

function generateRandomNumber(countryCode: string): string {
  const config = COUNTRY_PREFIXES[countryCode] ?? COUNTRY_PREFIXES.US;
  const digitCount = config.length;
  let digits = '';
  for (let i = 0; i < digitCount; i++) {
    digits += Math.floor(Math.random() * 10).toString();
  }
  return `${config.prefix}${digits}`;
}

// GET /api/v1/numbers — list all numbers
numbers.get('/', (c) => {
  const { db } = c.get('ctx');
  const list = getPhoneNumbers(db);
  return c.json(list);
});

// POST /api/v1/numbers — create number
numbers.post('/', async (c) => {
  const { db, broadcast } = c.get('ctx');

  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  const number = body.number as string | undefined;
  if (!number) {
    return c.json({ error: 'Missing required field: number' }, 400);
  }

  // Check for duplicates
  const existing = getPhoneNumberByNumber(db, number);
  if (existing) {
    return c.json({ error: 'Phone number already exists' }, 409);
  }

  const phone = createPhoneNumber(db, {
    number,
    label: body.label as string | undefined,
    country_code: body.country_code as string | undefined,
    behavior: (body.behavior as string | undefined) as 'deliver' | undefined,
    behavior_config: body.behavior_config as Record<string, unknown> | undefined,
    pinned: body.pinned as boolean | undefined,
  });

  broadcast({ type: 'number:created', data: phone });

  return c.json(phone, 201);
});

// POST /api/v1/numbers/generate — generate random E.164 number
numbers.post('/generate', async (c) => {
  const { db, broadcast } = c.get('ctx');

  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    body = {};
  }

  const countryCode = (body.country_code as string) ?? 'US';

  // Generate unique number (retry if collision)
  let number: string;
  let attempts = 0;
  do {
    number = generateRandomNumber(countryCode);
    attempts++;
    if (attempts > 100) {
      return c.json({ error: 'Failed to generate unique number' }, 500);
    }
  } while (getPhoneNumberByNumber(db, number));

  const phone = createPhoneNumber(db, {
    number,
    label: (body.label as string) ?? `Generated ${countryCode}`,
    country_code: countryCode,
    behavior: 'deliver',
  });

  broadcast({ type: 'number:created', data: phone });

  return c.json(phone, 201);
});

// PATCH /api/v1/numbers/:id — update number
numbers.patch('/:id', async (c) => {
  const { db, broadcast } = c.get('ctx');
  const id = c.req.param('id');

  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  const updated = updatePhoneNumber(db, id, {
    label: body.label as string | undefined,
    country_code: body.country_code as string | undefined,
    behavior: body.behavior as 'deliver' | undefined,
    behavior_config: body.behavior_config as Record<string, unknown> | undefined,
    pinned: body.pinned as boolean | undefined,
  });

  if (!updated) {
    return c.json({ error: 'Phone number not found' }, 404);
  }

  broadcast({ type: 'number:updated', data: updated });

  return c.json(updated);
});

// DELETE /api/v1/numbers/:id — delete number
numbers.delete('/:id', (c) => {
  const { db, broadcast } = c.get('ctx');
  const id = c.req.param('id');

  const existing = getPhoneNumberById(db, id);
  if (!existing) {
    return c.json({ error: 'Phone number not found' }, 404);
  }

  deletePhoneNumber(db, id);

  broadcast({ type: 'number:deleted', data: { id } });

  return c.body(null, 204);
});

export default numbers;
