import { createDatabase } from '../src/server/db/connection.js';
import { createApp } from '../src/server/index.js';
import type Database from 'better-sqlite3';
import type { Hono } from 'hono';
import type { AppEnv } from '../src/server/context.js';

export interface TestContext {
  app: Hono<AppEnv>;
  db: Database.Database;
}

export function createTestApp(): TestContext {
  const db = createDatabase(':memory:');
  const app = createApp(db);
  return { app, db };
}
