import { v4 as uuidv4 } from 'uuid';
import type Database from 'better-sqlite3';

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
