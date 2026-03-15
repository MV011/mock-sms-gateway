import { describe, it, expect, beforeEach } from 'vitest';
import { createDatabase } from '../src/server/db/connection.js';
import { seedMagicNumbers } from '../src/server/db/queries.js';
import Database from 'better-sqlite3';

describe('Database initialization', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createDatabase(':memory:');
  });

  it('creates phone_numbers table', () => {
    const row = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='phone_numbers'"
    ).get() as { name: string } | undefined;
    expect(row?.name).toBe('phone_numbers');
  });

  it('creates messages table', () => {
    const row = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='messages'"
    ).get() as { name: string } | undefined;
    expect(row?.name).toBe('messages');
  });

  it('creates settings table', () => {
    const row = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='settings'"
    ).get() as { name: string } | undefined;
    expect(row?.name).toBe('settings');
  });

  it('seeds 6 magic numbers on first boot', () => {
    const rows = db.prepare(
      "SELECT * FROM phone_numbers WHERE is_magic = 1"
    ).all();
    expect(rows).toHaveLength(6);
  });

  it('seeds magic numbers with correct behaviors', () => {
    const numbers = db.prepare(
      "SELECT number, behavior FROM phone_numbers WHERE is_magic = 1 ORDER BY number"
    ).all() as { number: string; behavior: string }[];

    expect(numbers).toEqual([
      { number: '+40700000001', behavior: 'deliver' },
      { number: '+40700000002', behavior: 'fail' },
      { number: '+40700000003', behavior: 'delay' },
      { number: '+40700000004', behavior: 'reject' },
      { number: '+40700000005', behavior: 'rate_limit' },
      { number: '+40700000006', behavior: 'timeout' },
    ]);
  });

  it('does not duplicate magic numbers on re-seed', () => {
    // createDatabase already seeded once; importing seedMagicNumbers and calling again
    // should not create duplicates
    seedMagicNumbers(db);
    const rows = db.prepare(
      "SELECT * FROM phone_numbers WHERE is_magic = 1"
    ).all();
    expect(rows).toHaveLength(6);
  });
});
