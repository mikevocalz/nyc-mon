/**
 * Fixed-window limiter per key (a Caller id). In memory, so each server
 * process counts on its own; that bounds a runaway client, not a determined
 * one spread across instances.
 */
export function createFixedWindowLimiter(options: { limit: number; windowMs: number; now?: () => number }): (key: string) => boolean {
  const { limit, windowMs } = options;
  const now = options.now ?? Date.now;
  const windows = new Map<string, { start: number; count: number }>();
  return (key) => {
    const t = now();
    const current = windows.get(key);
    if (current === undefined || t - current.start >= windowMs) {
      // Drop stale windows now and then so the map cannot grow without bound.
      if (windows.size > 10_000) for (const [k, w] of windows) if (t - w.start >= windowMs) windows.delete(k);
      windows.set(key, { start: t, count: 1 });
      return true;
    }
    if (current.count >= limit) return false;
    current.count += 1;
    return true;
  };
}
