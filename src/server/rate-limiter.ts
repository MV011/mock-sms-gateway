export class RateLimiter {
  private timestamps: Map<string, number[]> = new Map();

  /**
   * Check if a phone number is within the rate limit.
   * Returns true if allowed, false if blocked.
   */
  check(phone: string, max: number, windowSeconds: number): boolean {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const entries = this.timestamps.get(phone) ?? [];

    // Filter to only timestamps within the window
    const withinWindow = entries.filter(ts => now - ts < windowMs);
    return withinWindow.length < max;
  }

  /**
   * Record a send for a phone number.
   * Prunes timestamps outside the window to prevent memory leaks.
   * Defaults to 3600 seconds (1 hour) if windowSeconds is not provided.
   */
  record(phone: string, windowSeconds: number = 3600): void {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const entries = this.timestamps.get(phone) ?? [];
    const pruned = entries.filter(ts => now - ts < windowMs);
    pruned.push(now);
    this.timestamps.set(phone, pruned);
  }

  /**
   * Clear all rate limit data.
   */
  clear(): void {
    this.timestamps.clear();
  }
}
