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
      SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
      SUM(CASE WHEN direction = 'outbound' THEN 1 ELSE 0 END) as outbound,
      SUM(CASE WHEN direction = 'inbound' THEN 1 ELSE 0 END) as inbound,
      SUM(CASE WHEN phone_id IS NULL THEN 1 ELSE 0 END) as catch_all
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
