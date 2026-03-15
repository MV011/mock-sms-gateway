import { Hono } from 'hono';
import type { AppEnv } from '../context.js';

const stats = new Hono<AppEnv>();

interface StatsRow {
  total: number;
  delivered: number;
  failed: number;
  pending: number;
  rejected: number;
  outbound: number;
  inbound: number;
  catch_all: number;
}

// GET /api/v1/stats — message statistics
stats.get('/', (c) => {
  const { db } = c.get('ctx');

  const row = db.prepare(`
    SELECT
      COUNT(*) as total,
      COALESCE(SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END), 0) as delivered,
      COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0) as failed,
      COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) as pending,
      COALESCE(SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END), 0) as rejected,
      COALESCE(SUM(CASE WHEN direction = 'outbound' THEN 1 ELSE 0 END), 0) as outbound,
      COALESCE(SUM(CASE WHEN direction = 'inbound' THEN 1 ELSE 0 END), 0) as inbound,
      COALESCE(SUM(CASE WHEN phone_id IS NULL THEN 1 ELSE 0 END), 0) as catch_all
    FROM messages
  `).get() as StatsRow;

  return c.json({
    total: row.total,
    delivered: row.delivered,
    failed: row.failed,
    pending: row.pending,
    rejected: row.rejected,
    outbound: row.outbound,
    inbound: row.inbound,
    catch_all: row.catch_all,
  });
});

export default stats;
