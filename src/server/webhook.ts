/**
 * Webhook dispatcher with SSRF protection.
 */

import dns from 'node:dns';

function matchesPattern(host: string, pattern: string): boolean {
  // Exact match
  if (host === pattern) return true;

  // Wildcard match (e.g., "*.internal") — requires at least one subdomain label
  if (pattern.startsWith('*.')) {
    const suffix = pattern.slice(1); // ".internal"
    return host.endsWith(suffix);
  }

  return false;
}

/**
 * Check if an IP address is in a private/reserved range that should be blocked
 * to prevent SSRF attacks.
 */
function isPrivateIP(ip: string): boolean {
  // IPv6 loopback
  if (ip === '::1') return true;

  // Normalize IPv4-mapped IPv6 (e.g. "::ffff:127.0.0.1")
  const v4 = ip.startsWith('::ffff:') ? ip.slice(7) : ip;

  const parts = v4.split('.').map(Number);
  if (parts.length !== 4 || parts.some(p => isNaN(p))) return false;

  const [a, b] = parts;

  // 0.0.0.0
  if (v4 === '0.0.0.0') return true;
  // 127.0.0.0/8 (loopback)
  if (a === 127) return true;
  // 10.0.0.0/8
  if (a === 10) return true;
  // 172.16.0.0/12
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168.0.0/16
  if (a === 192 && b === 168) return true;
  // 169.254.0.0/16 (link-local / AWS IMDS)
  if (a === 169 && b === 254) return true;

  return false;
}

/**
 * Resolve the hostname and check that it doesn't point to a private/reserved IP.
 * Returns an error string if blocked, or null if allowed.
 */
async function checkResolvedIP(hostname: string): Promise<string | null> {
  try {
    const { address } = await dns.promises.lookup(hostname);
    if (isPrivateIP(address)) {
      return `Blocked: ${hostname} resolves to private IP ${address}`;
    }
    return null;
  } catch {
    return `DNS resolution failed for ${hostname}`;
  }
}

export function isAllowedHost(url: string, allowedHosts: string | undefined): boolean {
  if (!allowedHosts) return true; // No restriction

  const patterns = allowedHosts.split(',').map(h => h.trim()).filter(Boolean);
  if (patterns.length === 0) return true;

  try {
    const parsed = new URL(url);
    return patterns.some(pattern => matchesPattern(parsed.hostname, pattern));
  } catch {
    return false;
  }
}

export interface WebhookPayload {
  from: string;
  body: string;
  message_id: string;
  timestamp: string;
}

export async function dispatchWebhook(
  url: string,
  payload: WebhookPayload,
  allowedHosts?: string,
): Promise<{ success: boolean; error?: string }> {
  // SSRF protection: allowlist check
  if (!isAllowedHost(url, allowedHosts)) {
    return { success: false, error: `Host not allowed: ${url}` };
  }

  // SSRF protection: block private/reserved IPs
  try {
    const parsed = new URL(url);
    const ipError = await checkResolvedIP(parsed.hostname);
    if (ipError) {
      return { success: false, error: ipError };
    }
  } catch {
    return { success: false, error: `Invalid URL: ${url}` };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      return { success: false, error: `Webhook returned ${res.status}` };
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: message };
  }
}
