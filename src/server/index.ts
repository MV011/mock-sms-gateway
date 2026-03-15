import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type Database from 'better-sqlite3';
import type { AppEnv } from './context.js';
import type { AppContext } from './context.js';
import { RateLimiter } from './rate-limiter.js';
import sendRoute from './routes/send.js';
import numbersRoute from './routes/numbers.js';
import messagesRoute from './routes/messages.js';
import replyRoute from './routes/reply.js';
import statsRoute from './routes/stats.js';
import { resetAll } from './db/queries.js';

export interface AppInstance {
  app: Hono<AppEnv>;
  ctx: AppContext;
}

export function createApp(db: Database.Database): AppInstance {
  const app = new Hono<AppEnv>();
  const rateLimiter = new RateLimiter();

  // No-op broadcast by default (WebSocket will override later)
  const broadcast = (_event: { type: string; data: unknown }) => {};

  const ctx: AppContext = { db, rateLimiter, broadcast };

  // CORS
  const corsOrigin = process.env.CORS_ORIGIN ?? '*';
  if (!process.env.CORS_ORIGIN) {
    console.warn("Warning: CORS_ORIGIN not set — defaulting to '*'. Set CORS_ORIGIN for staging/production.");
  }
  app.use('*', cors({ origin: corsOrigin }));

  // API key auth
  const apiKey = process.env.API_KEY;
  if (apiKey) {
    app.use('/api/*', async (c, next) => {
      const provided = c.req.header('X-API-Key');
      if (provided !== apiKey) {
        return c.json({ error: 'Unauthorized' }, 401);
      }
      await next();
    });
  } else {
    console.warn('Warning: API_KEY not set — API is unauthenticated. Set API_KEY for staging/production deployments.');
  }

  // Global error handler
  app.onError((err, c) => {
    console.error('Unhandled error:', err);
    return c.json({ error: 'Internal server error', detail: err.message }, 500);
  });

  // Inject context
  app.use('*', async (c, next) => {
    c.set('ctx', ctx);
    await next();
  });

  // Health check
  app.get('/api/v1/health', (c) => c.json({ status: 'ok' }));

  // Routes
  app.route('/api/v1/send', sendRoute);
  app.route('/api/v1/numbers', numbersRoute);
  app.route('/api/v1/messages', messagesRoute);
  app.route('/api/v1/reply', replyRoute);
  app.route('/api/v1/stats', statsRoute);

  // Reset endpoint
  app.post('/api/v1/reset', (c) => {
    const { db, rateLimiter, broadcast } = c.get('ctx');
    resetAll(db);
    rateLimiter.clear();
    broadcast({ type: 'reset', data: {} });
    return c.json({ success: true });
  });

  return { app, ctx };
}

/**
 * Add static file serving for the built Vite frontend.
 * Only applies when dist/client directory exists (production).
 * In dev mode, Vite's dev server handles static files via proxy.
 */
export async function addStaticServing(app: Hono<AppEnv>): Promise<void> {
  const __dirname = resolve(fileURLToPath(import.meta.url), '..');
  const clientDir = resolve(__dirname, '..', 'client');

  if (!existsSync(clientDir)) {
    return;
  }

  const { serveStatic } = await import('@hono/node-server/serve-static');

  // Serve static assets from dist/client
  app.use(
    '/*',
    serveStatic({ root: clientDir }),
  );

  // SPA fallback: serve index.html for non-API, non-WS routes
  app.get(
    '*',
    serveStatic({ root: clientDir, path: 'index.html' }),
  );
}

// Start server when run directly
const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectRun) {
  const { serve } = await import('@hono/node-server');
  const { createDatabase } = await import('./db/connection.js');
  const { attachWebSocket } = await import('./routes/ws.js');

  const storage = process.env.STORAGE ?? 'memory';
  const storagePath = storage === 'memory' ? ':memory:' : storage;
  const port = parseInt(process.env.PORT ?? '8026', 10);

  const db = createDatabase(storagePath);
  const { app, ctx } = createApp(db);

  // Add static file serving for production builds
  await addStaticServing(app);

  const server = serve({ fetch: app.fetch, port }, () => {
    console.log(`Mock SMS Gateway running on http://localhost:${port}`);
  });

  // Attach WebSocket server to the HTTP server
  attachWebSocket(server as import('node:http').Server, ctx);
}
