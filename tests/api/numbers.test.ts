import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestApp, type TestContext } from '../helpers.js';

describe('Numbers API', () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestApp();
  });

  afterEach(() => {
    ctx.db.close();
  });

  describe('GET /api/v1/numbers', () => {
    it('lists all numbers including magic numbers', async () => {
      const res = await ctx.app.request('/api/v1/numbers');
      expect(res.status).toBe(200);
      const data = await res.json();
      // Should have at least the 6 magic numbers
      expect(data.length).toBeGreaterThanOrEqual(6);
    });
  });

  describe('POST /api/v1/numbers', () => {
    it('creates a phone number', async () => {
      const res = await ctx.app.request('/api/v1/numbers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          number: '+40712345678',
          label: 'Test Patient',
          country_code: 'RO',
          behavior: 'deliver',
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.number).toBe('+40712345678');
      expect(data.label).toBe('Test Patient');
      expect(data.id).toBeDefined();
    });

    it('rejects missing number', async () => {
      const res = await ctx.app.request('/api/v1/numbers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: 'No number' }),
      });

      expect(res.status).toBe(400);
    });

    it('rejects duplicate number', async () => {
      await ctx.app.request('/api/v1/numbers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: '+40712345678' }),
      });

      const res = await ctx.app.request('/api/v1/numbers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: '+40712345678' }),
      });

      expect(res.status).toBe(409);
    });
  });

  describe('PATCH /api/v1/numbers/:id', () => {
    it('updates a phone number', async () => {
      // Create a number first
      const createRes = await ctx.app.request('/api/v1/numbers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: '+40712345678', label: 'Original' }),
      });
      const created = await createRes.json();

      const res = await ctx.app.request(`/api/v1/numbers/${created.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: 'Updated', behavior: 'fail' }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.label).toBe('Updated');
      expect(data.behavior).toBe('fail');
    });

    it('returns 404 for non-existent id', async () => {
      const res = await ctx.app.request('/api/v1/numbers/non-existent', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: 'Updated' }),
      });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/numbers/:id', () => {
    it('deletes a phone number', async () => {
      const createRes = await ctx.app.request('/api/v1/numbers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: '+40712345678' }),
      });
      const created = await createRes.json();

      const res = await ctx.app.request(`/api/v1/numbers/${created.id}`, {
        method: 'DELETE',
      });

      expect(res.status).toBe(204);

      // Verify it's gone
      const listRes = await ctx.app.request('/api/v1/numbers');
      const numbers = await listRes.json();
      expect(numbers.find((n: { id: string }) => n.id === created.id)).toBeUndefined();
    });

    it('returns 404 for non-existent id', async () => {
      const res = await ctx.app.request('/api/v1/numbers/non-existent', {
        method: 'DELETE',
      });

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/v1/numbers — invalid JSON', () => {
    it('rejects non-JSON body with 400', async () => {
      const res = await ctx.app.request('/api/v1/numbers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not valid json',
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBeDefined();
    });
  });

  describe('POST /api/v1/numbers/generate', () => {
    it('generates a random number for a country', async () => {
      const res = await ctx.app.request('/api/v1/numbers/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ country_code: 'RO' }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.number).toMatch(/^\+407\d{8}$/);
      expect(data.country_code).toBe('RO');
    });

    it('generates US number', async () => {
      const res = await ctx.app.request('/api/v1/numbers/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ country_code: 'US' }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.number).toMatch(/^\+1\d{10}$/);
    });
  });
});
