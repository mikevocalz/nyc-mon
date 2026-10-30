// Web and Node: binary downloads use the platform fetch. The native entry is index.native.ts.
import type { FetchLike, FetchTransport } from './resolve.ts';

export type { FetchLike, FetchTransport } from './resolve.ts';

export const binaryFetch: FetchLike = (input, init) => globalThis.fetch(input, init);

export const binaryFetchTransport = (): FetchTransport => 'global';
