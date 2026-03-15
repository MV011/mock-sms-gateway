import Database from 'better-sqlite3';
import { SCHEMA } from './schema.js';
import { seedMagicNumbers } from './queries.js';

export function createDatabase(storagePath: string = ':memory:'): Database.Database {
  const db = new Database(storagePath);

  // Enable WAL mode for file-backed databases
  if (storagePath !== ':memory:') {
    db.pragma('journal_mode = WAL');
  }

  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  // Apply schema
  db.exec(SCHEMA);

  // Seed magic numbers
  seedMagicNumbers(db);

  return db;
}
