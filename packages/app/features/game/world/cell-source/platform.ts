// Web / Node platform IO for the cell source: globalThis.fetch and WebCrypto's sha256. The store is Cache Storage
// where the browser has it, else the explicit memory store (store.ts).
import { createDefaultStore } from './store.ts';
import type { CellIo, CellStore } from './types.ts';

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

export function platformIo(): CellIo {
  return {
    async fetchBytes(url, signal) {
      const res = await fetch(url, { signal: signal ?? null });
      if (!res.ok) throw new Error(`cell source: GET ${url} answered ${res.status}`);
      return new Uint8Array(await res.arrayBuffer());
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
