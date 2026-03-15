import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type Database from 'better-sqlite3';
import type { AppEnv } from './context.js';
import type { AppContext } from './context.js';
import { RateLimiter } from './rate-limiter.js';
import sendRoute from './routes/send.js';

export function createApp(db: Database.Database): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  const rateLimiter = new RateLimiter();

  // No-op broadcast by default (WebSocket will override later)
  const broadcast = (_event: { type: string; data: unknown }) => {};

  const ctx: AppContext = { db, rateLimiter, broadcast };

  // CORS
  const corsOrigin = process.env.CORS_ORIGIN ?? '*';
  app.use('*', cors({ origin: corsOrigin }));

  // Optional API key auth
  const apiKey = process.env.API_KEY;
  if (apiKey) {
    app.use('/api/*', async (c, next) => {
      const provided = c.req.header('X-API-Key');
      if (provided !== apiKey) {
        return c.json({ error: 'Unauthorized' }, 401);
      }
      await next();
    });
  }

  // Inject context
  app.use('*', async (c, next) => {
    c.set('ctx', ctx);
    await next();
  });

  // Health check
  app.get('/api/v1/health', (c) => c.json({ status: 'ok' }));

  // Routes
  app.route('/api/v1/send', sendRoute);

  return app;
}

// Start server when run directly
const isDirectRun = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));
if (isDirectRun) {
  const { serve } = await import('@hono/node-server');
  const { createDatabase } = await import('./db/connection.js');

  const storage = process.env.STORAGE ?? 'memory';
  const storagePath = storage === 'memory' ? ':memory:' : storage;
  const port = parseInt(process.env.PORT ?? '8026', 10);

  const db = createDatabase(storagePath);
  const app = createApp(db);

  serve({ fetch: app.fetch, port }, () => {
    console.log(`Mock SMS Gateway running on http://localhost:${port}`);
  });
}
