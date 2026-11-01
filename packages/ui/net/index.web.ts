// Browser: binary downloads go through react-native-nitro-fetch's web entry (its `browser` export,
// lib/module/index.web.js), the same import the native side uses. On web it hands the request to the browser's own
// fetch, so the response is a real streaming Response. Node (tests, server rendering) resolves index.ts instead:
// the package's `default` export is the native build, which loads Nitro modules.
import { fetch as nitroFetch } from 'react-native-nitro-fetch';
import type { FetchLike, FetchTransport } from './resolve.ts';

export type { FetchLike, FetchTransport } from './resolve.ts';

export const binaryFetch: FetchLike = (input, init) => nitroFetch(input, init);

export const binaryFetchTransport = (): FetchTransport => 'nitro';
