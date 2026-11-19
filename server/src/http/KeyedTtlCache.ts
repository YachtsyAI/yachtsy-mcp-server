import { createHash } from "node:crypto";

type Entry<V> = { value: Promise<V>; expiresAt: number };

/**
 * A small TTL cache of per-caller lookups, keyed by a hash so raw API keys
 * never sit in a map, bounded by least-recent eviction.
 *
 * A load that rejects, or resolves to a value `keep` refuses (a fallback),
 * is dropped at once rather than served for the whole TTL. elephant-mcp had
 * two copies of this class and one of them cached its fallback for a minute.
 */
export class KeyedTtlCache<V> {
  private readonly entries = new Map<string, Entry<V>>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries: number,
    private readonly now: () => number = Date.now,
  ) {}

  get(
    parts: readonly string[],
    load: () => Promise<V>,
    keep: (value: V) => boolean = () => true,
  ): Promise<V> {
    const key = createHash("sha256").update(parts.join("\u0000")).digest("hex");
    const hit = this.entries.get(key);
    if (hit && hit.expiresAt > this.now()) return hit.value;

    const value = load();
    const entry: Entry<V> = { value, expiresAt: this.now() + this.ttlMs };
    const evict = () => {
      // Only if still ours: a newer load for the same key must survive
      if (this.entries.get(key) === entry) this.entries.delete(key);
    };
    value.then((resolved) => (keep(resolved) ? undefined : evict()), evict);
    this.entries.delete(key);
    this.entries.set(key, entry);
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
    return value;
  }
}
