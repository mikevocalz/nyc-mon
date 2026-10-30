// Native binary downloads (city cells, egg GLBs, furniture packs, audio clips) go through react-native-nitro-fetch:
// URLSession on iOS, Cronet on Android, with the body handed to JS as one ArrayBuffer. When the native module is
// missing the platform fetch is used instead (see resolve.ts). Authenticated API calls stay on the platform fetch,
// which shares the app's cookie store.
import { resolveFetch, type FetchLike, type FetchTransport, type ResolvedFetch } from './resolve.ts';

export type { FetchLike, FetchTransport } from './resolve.ts';

let resolved: ResolvedFetch | undefined;

function current(): ResolvedFetch {
  if (resolved) return resolved;
  resolved = resolveFetch(
    // A literal require inside the guard: Metro bundles it, and the module's load-time throw lands in resolveFetch.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    () => require('react-native-nitro-fetch') as { fetch?: unknown },
    (input, init) => globalThis.fetch(input, init),
  );
  if (resolved.transport === 'global') console.warn('[net] react-native-nitro-fetch unavailable; binary downloads use the platform fetch', resolved.reason);
  return resolved;
}

/** fetch for binary downloads: nitro-fetch when its native module is present, else the platform fetch. */
export const binaryFetch: FetchLike = (input, init) => current().fetch(input, init);

/** Which transport binaryFetch resolved to. */
export const binaryFetchTransport = (): FetchTransport => current().transport;
