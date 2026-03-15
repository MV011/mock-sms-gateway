import type Database from 'better-sqlite3';
import type { RateLimiter } from './rate-limiter.js';

export interface AppContext {
  db: Database.Database;
  rateLimiter: RateLimiter;
  broadcast: (event: { type: string; data: unknown }) => void;
}

export interface AppEnv {
  Variables: {
    ctx: AppContext;
  };
}
