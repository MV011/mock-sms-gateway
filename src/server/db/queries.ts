import { v4 as uuidv4 } from 'uuid';
import type Database from 'better-sqlite3';

// ---------- Types ----------

export type Behavior = 'deliver' | 'fail' | 'delay' | 'reject' | 'rate_limit' | 'timeout';

export interface PhoneNumber {
  id: string;
  number: string;
  label: string | null;
  country_code: string | null;
  behavior: Behavior;
  behavior_config: Record<string, unknown> | null;
  is_magic: boolean;
  pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreatePhoneNumberInput {
  number: string;
  label?: string;
  country_code?: string;
  behavior?: Behavior;
  behavior_config?: Record<string, unknown>;
  pinned?: boolean;
}

export interface UpdatePhoneNumberInput {
  label?: string;
  country_code?: string;
  behavior?: Behavior;
  behavior_config?: Record<string, unknown>;
  pinned?: boolean;
}

export interface MagicNumber {
  number: string;
  label: string;
  behavior: string;
  behavior_config: Record<string, unknown> | null;
}

const MAGIC_NUMBERS: MagicNumber[] = [
  { number: '+40700000001', label: 'Always Deliver', behavior: 'deliver', behavior_config: null },
  { number: '+40700000002', label: 'Always Fail', behavior: 'fail', behavior_config: { error_message: 'Simulated provider error' } },
  { number: '+40700000003', label: 'Slow Delivery (3s)', behavior: 'delay', behavior_config: { delay_ms: 3000 } },
  { number: '+40700000004', label: 'Invalid Number', behavior: 'reject', behavior_config: { error_message: 'Invalid phone number' } },
  { number: '+40700000005', label: 'Rate Limited (5/hr)', behavior: 'rate_limit', behavior_config: { max_messages: 5, window_seconds: 3600 } },
  { number: '+40700000006', label: 'Timeout (30s)', behavior: 'timeout', behavior_config: { timeout_ms: 30000 } },
];

export function seedMagicNumbers(db: Database.Database): void {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO phone_numbers (id, number, label, country_code, behavior, behavior_config, is_magic, pinned, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, 1, ?, ?)
  `);

  const now = new Date().toISOString();

  const insertAll = db.transaction(() => {
    for (const magic of MAGIC_NUMBERS) {
      insert.run(
        uuidv4(),
        magic.number,
        magic.label,
        'RO',
        magic.behavior,
        magic.behavior_config ? JSON.stringify(magic.behavior_config) : null,
        now,
        now
      );
    }
  });

  insertAll();
}

// ---------- Row helpers ----------

interface PhoneNumberRow {
  id: string;
  number: string;
  label: string | null;
  country_code: string | null;
  behavior: string;
  behavior_config: string | null;
  is_magic: number;
  pinned: number;
  created_at: string;
  updated_at: string;
}

function rowToPhoneNumber(row: PhoneNumberRow): PhoneNumber {
  return {
    id: row.id,
    number: row.number,
    label: row.label,
    country_code: row.country_code,
    behavior: row.behavior as Behavior,
    behavior_config: row.behavior_config
      ? (() => {
          try {
            return JSON.parse(row.behavior_config!) as Record<string, unknown>;
          } catch {
            console.warn(`Failed to parse behavior_config for phone number ${row.id}, defaulting to {}`);
            return {};
          }
        })()
      : null,
    is_magic: row.is_magic === 1,
    pinned: row.pinned === 1,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// ---------- Phone Number CRUD ----------

export function createPhoneNumber(db: Database.Database, input: CreatePhoneNumberInput): PhoneNumber {
  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO phone_numbers (id, number, label, country_code, behavior, behavior_config, is_magic, pinned, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
  `).run(
    id,
    input.number,
    input.label ?? null,
    input.country_code ?? null,
    input.behavior ?? 'deliver',
    input.behavior_config ? JSON.stringify(input.behavior_config) : null,
    input.pinned ? 1 : 0,
    now,
    now,
  );

  const result = getPhoneNumberById(db, id);
  if (!result) throw new Error(`Failed to read back phone number after insert: ${id}`);
  return result;
}

export function getPhoneNumbers(db: Database.Database): PhoneNumber[] {
  const rows = db.prepare(
    'SELECT * FROM phone_numbers ORDER BY pinned DESC, created_at ASC'
  ).all() as PhoneNumberRow[];

  return rows.map(rowToPhoneNumber);
}

export function getPhoneNumberById(db: Database.Database, id: string): PhoneNumber | undefined {
  const row = db.prepare('SELECT * FROM phone_numbers WHERE id = ?').get(id) as PhoneNumberRow | undefined;
  return row ? rowToPhoneNumber(row) : undefined;
}

export function getPhoneNumberByNumber(db: Database.Database, number: string): PhoneNumber | undefined {
  const row = db.prepare('SELECT * FROM phone_numbers WHERE number = ?').get(number) as PhoneNumberRow | undefined;
  return row ? rowToPhoneNumber(row) : undefined;
}

export function updatePhoneNumber(db: Database.Database, id: string, input: UpdatePhoneNumberInput): PhoneNumber | undefined {
  const existing = getPhoneNumberById(db, id);
  if (!existing) return undefined;

  const now = new Date().toISOString();

  db.prepare(`
    UPDATE phone_numbers
    SET label = ?, country_code = ?, behavior = ?, behavior_config = ?, pinned = ?, updated_at = ?
    WHERE id = ?
  `).run(
    input.label !== undefined ? input.label : existing.label,
    input.country_code !== undefined ? input.country_code : existing.country_code,
    input.behavior !== undefined ? input.behavior : existing.behavior,
    input.behavior_config !== undefined
      ? (input.behavior_config ? JSON.stringify(input.behavior_config) : null)
      : (existing.behavior_config ? JSON.stringify(existing.behavior_config) : null),
    input.pinned !== undefined ? (input.pinned ? 1 : 0) : (existing.pinned ? 1 : 0),
    now,
    id,
  );

  return getPhoneNumberById(db, id);
}

export function deletePhoneNumber(db: Database.Database, id: string): boolean {
  const result = db.prepare('DELETE FROM phone_numbers WHERE id = ?').run(id);
  return result.changes > 0;
}

// ---------- Message Types ----------

export type Direction = 'outbound' | 'inbound';
export type MessageStatus = 'delivered' | 'failed' | 'pending' | 'rejected';

export interface Message {
  id: string;
  phone_id: string | null;
  phone_number: string;
  direction: Direction;
  body: string;
  from_name: string | null;
  template_key: string | null;
  status: MessageStatus;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
  webhook_status: string | null;
  created_at: string;
}

export interface CreateMessageInput {
  phone_number: string;
  direction: Direction;
  body: string;
  from_name?: string;
  template_key?: string;
  status: MessageStatus;
  error_message?: string;
  metadata?: Record<string, unknown>;
  webhook_status?: string;
}

export interface GetMessagesOptions {
  phone_id?: string;
  catch_all?: boolean;
  q?: string;
  direction?: Direction;
  status?: MessageStatus;
  limit?: number;
  offset?: number;
}

export interface PaginatedMessages {
  data: Message[];
  total: number;
  limit: number;
  offset: number;
}

// ---------- Message Row Helper ----------

interface MessageRow {
  id: string;
  phone_id: string | null;
  phone_number: string;
  direction: string;
  body: string;
  from_name: string | null;
  template_key: string | null;
  status: string;
  error_message: string | null;
  metadata: string | null;
  webhook_status: string | null;
  created_at: string;
}

function rowToMessage(row: MessageRow): Message {
  return {
    id: row.id,
    phone_id: row.phone_id,
    phone_number: row.phone_number,
    direction: row.direction as Direction,
    body: row.body,
    from_name: row.from_name,
    template_key: row.template_key,
    status: row.status as MessageStatus,
    error_message: row.error_message,
    metadata: row.metadata
      ? (() => {
          try {
            return JSON.parse(row.metadata!) as Record<string, unknown>;
          } catch {
            console.warn(`Failed to parse metadata for message ${row.id}, defaulting to {}`);
            return {};
          }
        })()
      : null,
    webhook_status: row.webhook_status,
    created_at: row.created_at,
  };
}

// ---------- Message CRUD ----------

export function createMessage(db: Database.Database, input: CreateMessageInput): Message {
  const id = uuidv4();
  const now = new Date().toISOString();

  // Auto-link to phone_numbers by looking up the phone_number
  const phone = getPhoneNumberByNumber(db, input.phone_number);
  const phoneId = phone?.id ?? null;

  db.prepare(`
    INSERT INTO messages (id, phone_id, phone_number, direction, body, from_name, template_key, status, error_message, metadata, webhook_status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    phoneId,
    input.phone_number,
    input.direction,
    input.body,
    input.from_name ?? null,
    input.template_key ?? null,
    input.status,
    input.error_message ?? null,
    input.metadata ? JSON.stringify(input.metadata) : null,
    input.webhook_status ?? null,
    now,
  );

  const result = getMessageById(db, id);
  if (!result) throw new Error(`Failed to read back message after insert: ${id}`);
  return result;
}

export function getMessageById(db: Database.Database, id: string): Message | undefined {
  const row = db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as MessageRow | undefined;
  return row ? rowToMessage(row) : undefined;
}

export function getMessages(db: Database.Database, options: GetMessagesOptions): PaginatedMessages {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (options.phone_id) {
    conditions.push('phone_id = ?');
    params.push(options.phone_id);
  }

  if (options.catch_all) {
    conditions.push('phone_id IS NULL');
  }

  if (options.q) {
    conditions.push('body LIKE ?');
    params.push(`%${options.q}%`);
  }

  if (options.direction) {
    conditions.push('direction = ?');
    params.push(options.direction);
  }

  if (options.status) {
    conditions.push('status = ?');
    params.push(options.status);
  }

  const whereClause = conditions.length > 0
    ? `WHERE ${conditions.join(' AND ')}`
    : '';

  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;

  // Get total count
  const countRow = db.prepare(
    `SELECT COUNT(*) as count FROM messages ${whereClause}`
  ).get(...params) as { count: number };
  const total = countRow.count;

  // Get paginated data
  const rows = db.prepare(
    `SELECT * FROM messages ${whereClause} ORDER BY created_at ASC LIMIT ? OFFSET ?`
  ).all(...params, limit, offset) as MessageRow[];

  return {
    data: rows.map(rowToMessage),
    total,
    limit,
    offset,
  };
}

export function clearMessages(db: Database.Database, phoneId?: string): void {
  if (phoneId) {
    db.prepare('DELETE FROM messages WHERE phone_id = ?').run(phoneId);
  } else {
    db.prepare('DELETE FROM messages').run();
  }
}

export function updateMessageWebhookStatus(db: Database.Database, id: string, webhookStatus: string): void {
  db.prepare('UPDATE messages SET webhook_status = ? WHERE id = ?').run(webhookStatus, id);
}

// ---------- Reset ----------

export function resetAll(db: Database.Database): void {
  db.prepare('DELETE FROM messages').run();
  db.prepare('DELETE FROM phone_numbers').run();
  seedMagicNumbers(db);
}
