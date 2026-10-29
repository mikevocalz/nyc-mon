/**
 * Sliding-window request limit per authenticated principal (a Caller id, or a
 * service client id). In process memory: one Render instance serves the MCP
 * endpoint, so a restart resets the windows.
 */
export interface RateLimiter {
  /** Counts one request for `key`. Returns 0 when allowed, else the seconds until the oldest hit leaves the window. */
  hit(key: string): number;
}

const WINDOW_MS = 60_000;
/** Above this many tracked principals, windows that have fully expired are dropped. */
const SWEEP_AT = 10_000;

export function createRateLimiter(perMinute: number, now: () => number): RateLimiter {
  const hits = new Map<string, number[]>();
  return {
    hit(key) {
      const t = now();
      const recent = (hits.get(key) ?? []).filter((at) => t - at < WINDOW_MS);
      if (recent.length >= perMinute) {
        hits.set(key, recent);
        return Math.max(1, Math.ceil((recent[0]! + WINDOW_MS - t) / 1000));
      }
      recent.push(t);
      hits.set(key, recent);
      if (hits.size > SWEEP_AT) {
        for (const [k, list] of hits) if (list.every((at) => t - at >= WINDOW_MS)) hits.delete(k);
      }
      return 0;
    },
  };
}
