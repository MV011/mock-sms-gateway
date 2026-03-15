import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestApp, type TestContext } from '../helpers.js';

describe('POST /api/v1/reply', () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestApp();
  });

  afterEach(() => {
    ctx.db.close();
  });

  it('creates an inbound message with valid from+body', async () => {
    const res = await ctx.app.request('/api/v1/reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: '+40700000001',
        body: 'DA',
      }),
    });

    // Accept both 200 (current) and 201 (if upgraded)
    expect([200, 201]).toContain(res.status);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.message_id).toBeDefined();
  });

  it('stores the reply as an inbound message', async () => {
    const replyRes = await ctx.app.request('/api/v1/reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: '+40700000001',
        body: 'CONFIRMARE',
      }),
    });

    const replyData = await replyRes.json();
    const messageId = replyData.message_id;

    // Fetch the message and verify direction + body
    const msgRes = await ctx.app.request(`/api/v1/messages/${messageId}`);
    expect(msgRes.status).toBe(200);
    const msg = await msgRes.json();
    expect(msg.direction).toBe('inbound');
    expect(msg.body).toBe('CONFIRMARE');
    expect(msg.phone_number).toBe('+40700000001');
    expect(msg.status).toBe('delivered');
  });

  it('returns 400 when from is missing', async () => {
    const res = await ctx.app.request('/api/v1/reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: 'STOP' }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it('returns 400 when body is missing', async () => {
    const res = await ctx.app.request('/api/v1/reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: '+40700000001' }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it('returns 400 for non-JSON body', async () => {
    const res = await ctx.app.request('/api/v1/reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'this is not valid json',
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it('reply from unknown number creates inbound catch-all message', async () => {
    const res = await ctx.app.request('/api/v1/reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: '+40799888777',
        body: 'Reply from unknown',
      }),
    });

    expect([200, 201]).toContain(res.status);
    const data = await res.json();
    expect(data.success).toBe(true);

    // Verify it was stored
    const msgRes = await ctx.app.request(`/api/v1/messages/${data.message_id}`);
    const msg = await msgRes.json();
    expect(msg.direction).toBe('inbound');
    expect(msg.phone_id).toBeNull();
  });
});
