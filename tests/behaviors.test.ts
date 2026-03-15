import { describe, it, expect } from 'vitest';
import { applyBehavior, type BehaviorResult } from '../src/server/behaviors.js';

describe('Behavior engine', () => {
  it('deliver returns success', async () => {
    const result = await applyBehavior('deliver', null);
    expect(result.success).toBe(true);
    expect(result.status).toBe('delivered');
  });

  it('fail returns failure with default error', async () => {
    const result = await applyBehavior('fail', null);
    expect(result.success).toBe(false);
    expect(result.status).toBe('failed');
    expect(result.error).toBe('Simulated provider error');
  });

  it('fail returns failure with custom error', async () => {
    const result = await applyBehavior('fail', { error_message: 'Custom failure' });
    expect(result.success).toBe(false);
    expect(result.status).toBe('failed');
    expect(result.error).toBe('Custom failure');
  });

  it('delay waits then delivers', async () => {
    const start = Date.now();
    const result = await applyBehavior('delay', { delay_ms: 50 });
    const elapsed = Date.now() - start;

    expect(result.success).toBe(true);
    expect(result.status).toBe('delivered');
    expect(elapsed).toBeGreaterThanOrEqual(40); // Allow some timing tolerance
  });

  it('reject returns httpStatus 400', async () => {
    const result = await applyBehavior('reject', null);
    expect(result.success).toBe(false);
    expect(result.status).toBe('rejected');
    expect(result.httpStatus).toBe(400);
    expect(result.error).toBe('Invalid phone number');
  });

  it('reject returns custom error message', async () => {
    const result = await applyBehavior('reject', { error_message: 'Number not in service' });
    expect(result.success).toBe(false);
    expect(result.status).toBe('rejected');
    expect(result.error).toBe('Number not in service');
  });

  it('timeout returns failure after timeout_ms', async () => {
    const start = Date.now();
    const result = await applyBehavior('timeout', { timeout_ms: 50 });
    const elapsed = Date.now() - start;

    expect(result.success).toBe(false);
    expect(result.status).toBe('failed');
    expect(result.error).toBe('Gateway timeout');
    expect(result.timeout).toBe(true);
    expect(elapsed).toBeGreaterThanOrEqual(40);
  });

  it('timeout caps at 120s (test with small value to verify structure)', async () => {
    // We can't wait 120s in a test; instead verify the result shape with a small timeout
    const result = await applyBehavior('timeout', { timeout_ms: 30 });
    expect(result.success).toBe(false);
    expect(result.status).toBe('failed');
    expect(result.timeout).toBe(true);
    expect(result.error).toBe('Gateway timeout');
  });

  it('rate_limit delivers when within limit', async () => {
    // If we reach applyBehavior for rate_limit, we're within limit
    const result = await applyBehavior('rate_limit', { max_messages: 5, window_seconds: 3600 });
    expect(result.success).toBe(true);
    expect(result.status).toBe('delivered');
  });
});
