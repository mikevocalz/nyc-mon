// Web / Node platform IO for the cell source: @acme/ui/net for the downloads (react-native-nitro-fetch's web fetch in
// a browser, globalThis.fetch under Node) and WebCrypto's sha256. The store is Cache Storage
// where the browser has it, else the explicit memory store (store.ts).
import { binaryFetch } from '@acme/ui/net';
import { createDefaultStore } from './store.ts';
import { fetchBytesWithDeadline, type DownloadDeadline } from './deadline.ts';
import type { CellIo, CellStore } from './types.ts';

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

export function platformIo(deadline?: DownloadDeadline): CellIo {
  return {
    async fetchBytes(url, signal) {
      return fetchBytesWithDeadline(url, signal, deadline, binaryFetch);
    },
    async sha256Hex(b) {
      const subtle = (globalThis as { crypto?: { subtle?: SubtleCrypto } }).crypto?.subtle;
      if (!subtle) throw new Error('cell source: no WebCrypto subtle digest on this runtime');
      return hex(await subtle.digest('SHA-256', b.slice().buffer as ArrayBuffer));
    },
    now: () => Date.now(),
  };
}

export function platformStore(): CellStore {
  return createDefaultStore();
}
