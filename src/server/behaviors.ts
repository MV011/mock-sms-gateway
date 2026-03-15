import type { Behavior, MessageStatus } from './db/queries.js';

export interface BehaviorResult {
  success: boolean;
  status: MessageStatus;
  error?: string;
  httpStatus?: number;
  timeout?: boolean;
}

const MAX_TIMEOUT_MS = 120_000;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function applyBehavior(
  behavior: Behavior,
  config: Record<string, unknown> | null,
): Promise<BehaviorResult> {
  switch (behavior) {
    case 'deliver':
      return { success: true, status: 'delivered' };

    case 'fail': {
      const errorMessage = (config?.error_message as string) ?? 'Simulated provider error';
      return { success: false, status: 'failed', error: errorMessage };
    }

    case 'delay': {
      const delayMs = Math.min((config?.delay_ms as number) ?? 3000, MAX_TIMEOUT_MS);
      await sleep(delayMs);
      return { success: true, status: 'delivered' };
    }

    case 'reject': {
      const errorMessage = (config?.error_message as string) ?? 'Invalid phone number';
      return { success: false, status: 'rejected', error: errorMessage, httpStatus: 400 };
    }

    case 'rate_limit':
      // If we reach applyBehavior for rate_limit, the caller already checked
      // that we're within the rate limit. So we deliver.
      return { success: true, status: 'delivered' };

    case 'timeout': {
      const timeoutMs = Math.min((config?.timeout_ms as number) ?? 30000, MAX_TIMEOUT_MS);
      await sleep(timeoutMs);
      return { success: false, status: 'failed', error: 'Gateway timeout', timeout: true };
    }

    default:
      console.warn(`Unknown behavior: ${behavior}`);
      return { success: false, status: 'failed', error: `Unknown behavior: ${behavior}` };
  }
}
