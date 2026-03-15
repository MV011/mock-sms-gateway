import type { Behavior } from './types.js';

export interface MagicNumberDef {
  number: string;
  label: string;
  behavior: Behavior;
  behavior_config: Record<string, unknown>;
}

export const MAGIC_NUMBERS: MagicNumberDef[] = [
  { number: '+40700000001', label: 'Always Deliver', behavior: 'deliver', behavior_config: {} },
  { number: '+40700000002', label: 'Always Fail', behavior: 'fail', behavior_config: { error_message: 'Simulated provider error' } },
  { number: '+40700000003', label: 'Slow Delivery (3s)', behavior: 'delay', behavior_config: { delay_ms: 3000 } },
  { number: '+40700000004', label: 'Invalid Number', behavior: 'reject', behavior_config: { error_message: 'Invalid phone number' } },
  { number: '+40700000005', label: 'Rate Limited (5/hr)', behavior: 'rate_limit', behavior_config: { max_messages: 5, window_seconds: 3600 } },
  { number: '+40700000006', label: 'Timeout (30s)', behavior: 'timeout', behavior_config: { timeout_ms: 30000 } },
];
