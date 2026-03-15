/**
 * Webhook dispatcher with SSRF protection.
 */

function matchesPattern(host: string, pattern: string): boolean {
  // Exact match
  if (host === pattern) return true;

  // Wildcard match (e.g., "*.internal")
  if (pattern.startsWith('*.')) {
    const suffix = pattern.slice(1); // ".internal"
    return host.endsWith(suffix) || host === pattern.slice(2);
  }

  return false;
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
  // SSRF protection
  if (!isAllowedHost(url, allowedHosts)) {
    return { success: false, error: `Host not allowed: ${url}` };
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
