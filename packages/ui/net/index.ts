// Node (tests, server rendering): binary downloads use the platform fetch. react-native-nitro-fetch has no Node
// entry (its `default` export is the native build), so it is not imported here. Browsers resolve index.web.ts and
// React Native resolves index.native.ts.
import type { FetchLike, FetchTransport } from './resolve.ts';

export type { FetchLike, FetchTransport } from './resolve.ts';

export const binaryFetch: FetchLike = (input, init) => globalThis.fetch(input, init);

export const binaryFetchTransport = (): FetchTransport => 'global';
