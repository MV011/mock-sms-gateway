import { describe, it, expect, beforeEach } from 'vitest';
import { createTestApp, type TestContext } from '../helpers.js';

describe('POST /api/v1/send', () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestApp();
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
});
