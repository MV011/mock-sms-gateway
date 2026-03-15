import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestApp, type TestContext } from '../helpers.js';

describe('POST /api/v1/send', () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestApp();
  });

  afterEach(() => {
    ctx.db.close();
  });

  it('delivers to known number', async () => {
    const res = await ctx.app.request('/api/v1/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: '+40700000001', // Always Deliver magic number
        body: 'Test message',
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.status).toBe('delivered');
    expect(data.message_id).toBeDefined();
    expect(data.to).toBe('+40700000001');
  });

  it('fails to fail-configured number', async () => {
    const res = await ctx.app.request('/api/v1/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: '+40700000002', // Always Fail magic number
        body: 'Test message',
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.status).toBe('failed');
    expect(data.error).toBe('Simulated provider error');
  });

  it('rejects to reject-configured number', async () => {
    const res = await ctx.app.request('/api/v1/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: '+40700000004', // Invalid Number magic number
        body: 'Test message',
      }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.status).toBe('rejected');
  });

  it('delivers to unknown number (catch-all)', async () => {
    const res = await ctx.app.request('/api/v1/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: '+40799999999',
        body: 'Unknown recipient',
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.status).toBe('delivered');
  });

  it('rejects missing body', async () => {
    const res = await ctx.app.request('/api/v1/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: '+40700000001',
      }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it('rejects missing to', async () => {
    const res = await ctx.app.request('/api/v1/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        body: 'Test message',
      }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it('stores from_name, template_key, and metadata', async () => {
    const res = await ctx.app.request('/api/v1/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: '+40700000001',
        body: 'Results are ready',
        from: 'PoliCircuit',
        template_key: 'results_ready',
        metadata: { order_id: '123' },
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.message_id).toBeDefined();
  });

  it('rejects non-JSON body with 400', async () => {
    const res = await ctx.app.request('/api/v1/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'this is not json',
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  describe('rate limiting (magic number +40700000005)', () => {
    it('returns 429 after exceeding rate limit', async () => {
      const to = '+40700000005'; // Rate Limited (5/hr)

      // Send 5 messages — all should succeed
      for (let i = 0; i < 5; i++) {
        const res = await ctx.app.request('/api/v1/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to, body: `Message ${i + 1}` }),
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.success).toBe(true);
        expect(data.status).toBe('delivered');
      }

      // 6th message should be rate limited
      const res = await ctx.app.request('/api/v1/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, body: 'Message 6 — should be blocked' }),
      });

      expect(res.status).toBe(429);
      const data = await res.json();
      expect(data.success).toBe(false);
    });
  });

  describe('timeout (custom number with short timeout)', () => {
    it('returns 504 with success:false for timeout behavior', async () => {
      // Create a custom number with timeout behavior and a short timeout_ms
      const createRes = await ctx.app.request('/api/v1/numbers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          number: '+40790000001',
          label: 'Fast Timeout',
          behavior: 'timeout',
          behavior_config: { timeout_ms: 50 },
        }),
      });
      expect(createRes.status).toBe(201);

      // Send to the timeout number
      const res = await ctx.app.request('/api/v1/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: '+40790000001',
          body: 'This should time out',
        }),
      });

      expect(res.status).toBe(504);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.status).toBe('failed');
    }, 10_000);
  });
});
