/**
 * Development-only warning for audio failures that point at a bug (a bad
 * note table, an API mismatch, a session write the OS refused). Missing
 * audio hardware or a blocked autoplay is not a bug and stays silent.
 * Production builds never log.
 */
export function isDev(): boolean {
  const g = globalThis as { __DEV__?: boolean; process?: { env?: { NODE_ENV?: string } } };
  if (typeof g.__DEV__ === 'boolean') return g.__DEV__;
  return g.process?.env?.NODE_ENV === 'development';
}

export function devWarn(message: string, error?: unknown): void {
  if (!isDev()) return;
  console.warn(`[@acme/ui audio] ${message}`, error ?? '');
}
