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
   */
  record(phone: string): void {
    const entries = this.timestamps.get(phone) ?? [];
    entries.push(Date.now());
    this.timestamps.set(phone, entries);
  }

  /**
   * Clear all rate limit data.
   */
  clear(): void {
    this.timestamps.clear();
  }
}
