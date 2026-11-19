type Bucket = { tokens: number; refilledAt: number };

export type RateLimitDecision =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

/**
 * Token-bucket limit per caller, held in memory.
 *
 * The Yachtsy API has its own limits and billing; this one exists so a single
 * runaway client cannot occupy the hosted server itself. Each key gets
 * `capacity` requests at once and refills evenly over a minute. State is
 * per-process, which is the right scope for protecting a process.
 */
export class RateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private readonly refillPerMs: number;

  constructor(
    private readonly capacity: number,
    private readonly maxKeys = 10_000,
    private readonly now: () => number = Date.now,
  ) {
    if (!Number.isFinite(capacity) || capacity <= 0) {
      throw new Error("Rate limit capacity must be a positive number.");
    }
    this.refillPerMs = capacity / 60_000;
  }

  take(key: string): RateLimitDecision {
    const at = this.now();
    const bucket = this.refilled(key, at);
    // Re-insert so the map's order tracks recency, which eviction relies on.
    this.buckets.delete(key);
    this.buckets.set(key, bucket);
    this.evictOverflow();

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return { allowed: true };
    }
    const waitMs = (1 - bucket.tokens) / this.refillPerMs;
    return { allowed: false, retryAfterSeconds: Math.ceil(waitMs / 1000) };
  }

  private refilled(key: string, at: number): Bucket {
    const bucket = this.buckets.get(key);
    if (!bucket) return { tokens: this.capacity, refilledAt: at };
    const earned = (at - bucket.refilledAt) * this.refillPerMs;
    return {
      tokens: Math.min(this.capacity, bucket.tokens + earned),
      refilledAt: at,
    };
  }

  private evictOverflow(): void {
    while (this.buckets.size > this.maxKeys) {
      const oldest = this.buckets.keys().next().value;
      if (oldest === undefined) return;
      this.buckets.delete(oldest);
    }
  }
}
