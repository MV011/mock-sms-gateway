/** Human-readable labels for phone-number behavior modes. */
export const BEHAVIOR_LABELS: Record<string, string> = {
  deliver: 'Deliver',
  fail: 'Always Fail',
  delay: 'Delayed',
  reject: 'Reject',
  rate_limit: 'Rate Limited',
  timeout: 'Timeout',
};

/** Tailwind color classes for behavior badges. */
export const BEHAVIOR_COLORS: Record<string, string> = {
  deliver: 'text-[#238636]',
  fail: 'text-red-400',
  delay: 'text-yellow-400',
  reject: 'text-orange-400',
  rate_limit: 'text-purple-400',
  timeout: 'text-gray-400',
};
