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
    behavior_config: row.behavior_config ? JSON.parse(row.behavior_config) : null,
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

  return getPhoneNumberById(db, id)!;
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
