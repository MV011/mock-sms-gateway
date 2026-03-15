import { describe, it, expect, beforeEach } from 'vitest';
import { createTestApp, type TestContext } from '../helpers.js';

describe('Messages API', () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestApp();
  });

  async function sendMessage(to: string, body: string) {
    return ctx.app.request('/api/v1/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, body }),
    });
  }

  describe('GET /api/v1/messages', () => {
    it('lists messages with pagination', async () => {
      // Send a few messages
      await sendMessage('+40700000001', 'Message 1');
      await sendMessage('+40700000001', 'Message 2');
      await sendMessage('+40700000001', 'Message 3');

      const res = await ctx.app.request('/api/v1/messages?limit=2&offset=0');
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data).toHaveLength(2);
      expect(data.total).toBe(3);
      expect(data.limit).toBe(2);
      expect(data.offset).toBe(0);
    });

    it('filters by phone_id', async () => {
      await sendMessage('+40700000001', 'Message 1');
      await sendMessage('+40700000002', 'Message 2');

      // Get the phone_id for +40700000001
      const numbersRes = await ctx.app.request('/api/v1/numbers');
      const numbers = await numbersRes.json();
      const phone = numbers.find((n: { number: string }) => n.number === '+40700000001');

      const res = await ctx.app.request(`/api/v1/messages?phone_id=${phone.id}`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data).toHaveLength(1);
      expect(data.data[0].phone_number).toBe('+40700000001');
    });

    it('filters catch_all messages', async () => {
      await sendMessage('+40700000001', 'Known');
      await sendMessage('+40799999999', 'Unknown');

      const res = await ctx.app.request('/api/v1/messages?catch_all=true');
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data).toHaveLength(1);
      expect(data.data[0].phone_number).toBe('+40799999999');
    });
  });

  describe('GET /api/v1/messages/:id', () => {
    it('gets a single message', async () => {
      const sendRes = await sendMessage('+40700000001', 'Test');
      const sendData = await sendRes.json();

      const res = await ctx.app.request(`/api/v1/messages/${sendData.message_id}`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.id).toBe(sendData.message_id);
      expect(data.body).toBe('Test');
    });

    it('returns 404 for non-existent message', async () => {
      const res = await ctx.app.request('/api/v1/messages/non-existent');
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/messages', () => {
    it('clears all messages', async () => {
      await sendMessage('+40700000001', 'Msg 1');
      await sendMessage('+40700000002', 'Msg 2');

      const res = await ctx.app.request('/api/v1/messages', { method: 'DELETE' });
      expect(res.status).toBe(204);

      const listRes = await ctx.app.request('/api/v1/messages');
      const data = await listRes.json();
      expect(data.data).toHaveLength(0);
    });

    it('clears messages for a specific phone', async () => {
      await sendMessage('+40700000001', 'Keep');
      await sendMessage('+40700000002', 'Clear');

      const numbersRes = await ctx.app.request('/api/v1/numbers');
      const numbers = await numbersRes.json();
      const phone = numbers.find((n: { number: string }) => n.number === '+40700000002');

      const res = await ctx.app.request(`/api/v1/messages?phone_id=${phone.id}`, {
        method: 'DELETE',
      });
      expect(res.status).toBe(204);

      const listRes = await ctx.app.request('/api/v1/messages');
      const data = await listRes.json();
      expect(data.data).toHaveLength(1);
      expect(data.data[0].phone_number).toBe('+40700000001');
    });
  });

  describe('POST /api/v1/reply', () => {
    it('creates an inbound message', async () => {
      const res = await ctx.app.request('/api/v1/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: '+40700000001',
          body: 'STOP',
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.message_id).toBeDefined();

      // Verify the message is stored as inbound
      const msgRes = await ctx.app.request(`/api/v1/messages/${data.message_id}`);
      const msg = await msgRes.json();
      expect(msg.direction).toBe('inbound');
      expect(msg.body).toBe('STOP');
    });

    it('rejects missing from', async () => {
      const res = await ctx.app.request('/api/v1/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: 'STOP' }),
      });

      expect(res.status).toBe(400);
    });

    it('rejects missing body', async () => {
      const res = await ctx.app.request('/api/v1/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: '+40700000001' }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/stats', () => {
    it('returns message statistics', async () => {
      await sendMessage('+40700000001', 'Delivered');
      await sendMessage('+40700000002', 'Failed');

      const res = await ctx.app.request('/api/v1/stats');
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.total).toBe(2);
      expect(data.delivered).toBeGreaterThanOrEqual(1);
      expect(data.failed).toBeGreaterThanOrEqual(1);
    });
  });

  describe('POST /api/v1/reset', () => {
    it('clears all data and re-seeds magic numbers', async () => {
      // Send some messages
      await sendMessage('+40700000001', 'Msg 1');

      // Create a custom number
      await ctx.app.request('/api/v1/numbers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: '+40712345678', label: 'Custom' }),
      });

      const res = await ctx.app.request('/api/v1/reset', { method: 'POST' });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);

      // Messages should be cleared
      const msgsRes = await ctx.app.request('/api/v1/messages');
      const msgs = await msgsRes.json();
      expect(msgs.data).toHaveLength(0);

      // Only magic numbers should remain
      const numbersRes = await ctx.app.request('/api/v1/numbers');
      const numbers = await numbersRes.json();
      expect(numbers).toHaveLength(6);
      expect(numbers.every((n: { is_magic: boolean }) => n.is_magic)).toBe(true);
    });
  });
});
