import { describe, it, expect } from 'vitest';
import { isAllowedHost, dispatchWebhook, type WebhookPayload } from '../src/server/webhook.js';

describe('isAllowedHost', () => {
  it('returns true when allowedHosts is undefined', () => {
    expect(isAllowedHost('https://example.com/hook', undefined)).toBe(true);
  });

  it('returns true when allowedHosts is empty string', () => {
    expect(isAllowedHost('https://example.com/hook', '')).toBe(true);
  });

  it('returns true for exact host match', () => {
    expect(isAllowedHost('https://example.com/hook', 'example.com')).toBe(true);
  });

  it('returns true for exact host match among multiple', () => {
    expect(
      isAllowedHost('https://api.example.com/hook', 'other.com, api.example.com, third.com'),
    ).toBe(true);
  });

  it('returns true for wildcard match *.example.com', () => {
    expect(
      isAllowedHost('https://sub.example.com/webhook', '*.example.com'),
    ).toBe(true);
  });

  it('returns true for deep subdomain with wildcard', () => {
    expect(
      isAllowedHost('https://deep.sub.example.com/webhook', '*.example.com'),
    ).toBe(true);
  });

  it('returns false when host does not match any pattern', () => {
    expect(
      isAllowedHost('https://evil.com/hook', 'example.com, *.trusted.com'),
    ).toBe(false);
  });

  it('returns false for invalid URL', () => {
    expect(isAllowedHost('not-a-url', 'example.com')).toBe(false);
  });

  it('wildcard does not match the bare domain itself', () => {
    // *.example.com should NOT match example.com (requires at least one subdomain label)
    expect(isAllowedHost('https://example.com/hook', '*.example.com')).toBe(false);
  });
});

describe('dispatchWebhook', () => {
  const payload: WebhookPayload = {
    from: '+40700000001',
    body: 'Test reply',
    message_id: 'test-id-123',
    timestamp: new Date().toISOString(),
  };

  it('returns { success: false } when host is not allowed', async () => {
    const result = await dispatchWebhook(
      'https://evil.com/hook',
      payload,
      'trusted.com',
    );

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('not allowed');
  });

  it('returns { success: false } for invalid URL', async () => {
    const result = await dispatchWebhook('not-a-url', payload);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
