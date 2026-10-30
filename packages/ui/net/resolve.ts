// Picks the fetch the native binary downloads go through. react-native-nitro-fetch builds its Nitro hybrid objects
// while its module loads, so a runtime without the native side (Expo Go, a binary built before the dependency, a
// test) throws on import. That throw is caught here once and the platform fetch takes over, with one warning; any
// later failure is a real network error and reaches the caller unchanged.

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
export type FetchTransport = 'nitro' | 'global';

export interface ResolvedFetch {
  fetch: FetchLike;
  transport: FetchTransport;
  /** Why nitro-fetch was not used (the load error), when it was not. */
  reason?: unknown;
}

export function resolveFetch(load: () => { fetch?: unknown }, fallback: FetchLike): ResolvedFetch {
  try {
    const mod = load();
    if (typeof mod?.fetch === 'function') return { fetch: mod.fetch as FetchLike, transport: 'nitro' };
    return { fetch: fallback, transport: 'global', reason: new Error('react-native-nitro-fetch exports no fetch') };
  } catch (reason) {
    return { fetch: fallback, transport: 'global', reason };
  }
}
