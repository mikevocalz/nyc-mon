// The on-demand cell source: hash-pinned downloads behind a bounded LRU disk cache, driven by the streamer's
// prefetch ring through `fetch` (the CellPackage lazy layer in world/cells/cell-rules.ts stays synchronous:
// a package reports ready() once these bytes are in).
//
// Read order per cell:
//   1. bundled loader for home cells (manifest `bundled`): the first launch works with no network and no cache;
//   2. the persisted cache (offline restart: no network touched);
//   3. the host, only when a baseUrl was configured — byte length and sha256 checked before the bytes leave here
//      or reach the cache;
//   4. a bundled loader handed in for a cell the manifest does not carry (unverified local fallback).
// A cell that cannot be produced resolves null: the caller keeps its far shell / previous level, never a crash.
import type { CellManifest, CellIo, CellStore } from './types.ts';

export interface CellSourceOptions {
  manifest: CellManifest;
  io: CellIo;
  store: CellStore;
  /** Remote root the manifest's paths hang under. Absent: bundled and cached copies only, no network. */
  baseUrl?: string;
  /** Simultaneous downloads. Default 3. */
  maxConcurrent?: number;
  /** Download attempts per fetch call (first try included). Default 2. */
  maxRetries?: number;
  /** Pause before a failed cell may be fetched again. Default 5000 ms. */
  retryCooldownMs?: number;
  /** Hard cap on one cell's bytes (defense in depth under the manifest's own pin). Default 64 MB. */
  maxCellBytes?: number;
  /** Cache capacity: evicts least recently read cells past it. Default 1.5 GB (the ipad-a12x row). */
  capacityBytes?: number;
}

export interface CellSource {
  /** Resolved once the persisted index is loaded and orphan files swept. */
  readonly ready: Promise<void>;
  /**
   * The cell's verified bytes, or null when they cannot be produced (unknown cell, corrupt copy, host down,
   * cancelled, disposed). `bundled` reads the cell's bundled copy when there is one (Metro asset).
   */
  fetch(key: string, bundled?: () => Promise<Uint8Array | ArrayBuffer>): Promise<Uint8Array | null>;
  /** Abandons an in-flight fetch without burning a retry slot. */
  cancel(key: string): void;
  stats(): { cached: number; bytes: number; inflight: number; queued: number };
  dispose(): void;
}

interface IndexEntry { name: string; bytes: number; sha256: string; at: number }
interface Waiter { promise: Promise<Uint8Array | null>; controller: AbortController; cancelled: boolean }

const INDEX_NAME = 'index.json';
const fileName = (key: string, sha256: string) => `${key.replace(/[^A-Za-z0-9_.-]/g, '_')}.${sha256.slice(0, 16)}.bin`;

export function createCellSource(o: CellSourceOptions): CellSource {
  const { manifest, io, store } = o;
  const maxConcurrent = o.maxConcurrent ?? 3;
  const maxRetries = o.maxRetries ?? 2;
  const retryCooldownMs = o.retryCooldownMs ?? 5000;
  const maxCellBytes = o.maxCellBytes ?? 64 * 1024 * 1024;
  const capacityBytes = o.capacityBytes ?? 1.5e9;
  const baseUrl = o.baseUrl?.replace(/\/+$/, '');

  const index = new Map<string, IndexEntry>();
  let totalBytes = 0;
  let disposed = false;
  const inflight = new Map<string, Waiter>();
  const cooldownUntil = new Map<string, number>();
  let slots = maxConcurrent;
  const gateQueue: (() => void)[] = [];
  let fetching = 0;

  const persist = () =>
    store.write(INDEX_NAME, new TextEncoder().encode(JSON.stringify({ v: 1, cells: Object.fromEntries(index) })));

  const init = (async () => {
    let saved: Record<string, IndexEntry> = {};
    try {
      const raw = await store.read(INDEX_NAME);
      if (raw) {
        const parsed = JSON.parse(new TextDecoder().decode(raw)) as { cells?: Record<string, IndexEntry> };
        for (const [k, e] of Object.entries(parsed.cells ?? {})) {
          if (e && typeof e.name === 'string' && typeof e.bytes === 'number' && typeof e.sha256 === 'string' && typeof e.at === 'number') saved[k] = e;
        }
      }
    } catch {
      await store.remove(INDEX_NAME).catch(() => {});
    }
    let names: string[] = [];
    try { names = await store.list(); } catch { /* an unlistable store serves nothing */ }
    const present = new Set(names);
    const keep = new Set<string>([INDEX_NAME]);
    for (const [k, e] of Object.entries(saved)) {
      if (!present.has(e.name)) continue;   // index points at a file already gone
      const pin = manifest.cells[k];
      if (pin && (pin.sha256 !== e.sha256 || pin.bytes !== e.bytes)) continue;   // manifest moved on: drop it
      index.set(k, e);
      totalBytes += e.bytes;
      keep.add(e.name);
    }
    for (const n of names) if (!keep.has(n)) await store.remove(n).catch(() => {});
  })();

  const acquire = () => new Promise<void>((resume) => {
    if (slots > 0) { slots--; resume(); } else gateQueue.push(resume);
  });
  const release = () => {
    const next = gateQueue.shift();
    if (next) next(); else if (slots < maxConcurrent) slots++;
  };

  const dropCached = async (key: string) => {
    const e = index.get(key);
    if (!e) return;
    index.delete(key);
    totalBytes -= e.bytes;
    await store.remove(e.name).catch(() => {});
    await persist().catch(() => {});
  };

  const evict = async () => {
    let oldest: string | null = null, oldestAt = Infinity;
    while (totalBytes > capacityBytes) {
      oldest = null; oldestAt = Infinity;
      for (const [k, e] of index) if (e.at < oldestAt) { oldest = k; oldestAt = e.at; }
      if (oldest === null) break;
      await dropCached(oldest);
    }
  };

  const promote = async (key: string, sha256: string, bytes: Uint8Array) => {
    await dropCached(key);
    const name = fileName(key, sha256);
    await store.write(name, bytes);
    index.set(key, { name, bytes: bytes.byteLength, sha256, at: io.now() });
    totalBytes += bytes.byteLength;
    await evict();
    await persist().catch(() => {});
  };

  const cachedRead = async (key: string, entryBytes: number): Promise<Uint8Array | null> => {
    const e = index.get(key);
    if (!e) return null;
    const bytes = await store.read(e.name).catch(() => null);
    if (bytes && bytes.byteLength === entryBytes) {
      e.at = io.now();
      return bytes;
    }
    await dropCached(key);   // missing or torn: never served
    return null;
  };

  const download = async (key: string, path: string, signal: AbortSignal): Promise<Uint8Array | null> => {
    await acquire();
    if (disposed) { release(); return null; }
    fetching++;
    try {
      return await io.fetchBytes(`${baseUrl}/${path}`, signal);
    } finally {
      fetching--;
      release();
    }
  };

  const tryBundled = async (bundled: () => Promise<Uint8Array | ArrayBuffer>, entryBytes: number | null, entrySha: string | null) => {
    const b = await bundled();
    const u8 = b instanceof Uint8Array ? b : new Uint8Array(b);
    if (entryBytes !== null && entrySha !== null && (u8.byteLength !== entryBytes || (await io.sha256Hex(u8)) !== entrySha)) return null;
    return u8;
  };

  const run = async (key: string, waiter: Waiter, bundled?: () => Promise<Uint8Array | ArrayBuffer>): Promise<Uint8Array | null> => {
    await init;
    const entry = manifest.cells[key];
    // Home cells: the bundled copy is preferred (first-launch offline). Unmanifested keys: the bundled copy is all
    // there is. Both verify against the manifest's pin when one exists, and fall through on any failure.
    if (bundled && (entry?.bundled === true || !entry)) {
      try {
        const b = await tryBundled(bundled, entry?.bytes ?? null, entry?.sha256 ?? null);
        if (b) return b;
      } catch { /* falls through to the cache and the host */ }
    }
    if (entry) {
      const hit = await cachedRead(key, entry.bytes);
      if (hit) return hit;
      if (baseUrl && !disposed && !waiter.cancelled && (cooldownUntil.get(key) ?? -1) <= io.now()) {
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          let got: Uint8Array | null = null;
          try {
            got = await download(key, entry.path, waiter.controller.signal);
          } catch {
            got = null;
          }
          if (waiter.cancelled || disposed) return null;
          if (got && got.byteLength === entry.bytes && got.byteLength <= maxCellBytes && (await io.sha256Hex(got).catch(() => null)) === entry.sha256) {
            await promote(key, entry.sha256, got).catch(() => {});
            return got;
          }
        }
        cooldownUntil.set(key, io.now() + retryCooldownMs);
      }
    }
    // Last resort for a non-home cell: its bundled copy, when a caller handed one in (verified where pinned).
    if (bundled && entry && entry.bundled !== true) {
      try {
        const b = await tryBundled(bundled, entry.bytes, entry.sha256);
        if (b) return b;
      } catch { /* */ }
    }
    return null;
  };

  return {
    ready: init.then(() => undefined),
    fetch(key, bundled) {
      if (disposed) return Promise.resolve(null);
      let w = inflight.get(key);
      if (!w) {
        const waiter: Waiter = { promise: null as never, controller: new AbortController(), cancelled: false };
        waiter.promise = run(key, waiter, bundled).finally(() => { if (inflight.get(key) === waiter) inflight.delete(key); });
        inflight.set(key, waiter);
        w = waiter;
      }
      return w.promise;
    },
    cancel(key) {
      const w = inflight.get(key);
      if (w) { w.cancelled = true; w.controller.abort(); inflight.delete(key); }
    },
    stats() {
      return { cached: index.size, bytes: totalBytes, inflight: fetching, queued: gateQueue.length };
    },
    dispose() {
      disposed = true;
      for (const w of inflight.values()) { w.cancelled = true; w.controller.abort(); }
      inflight.clear();
      // Parked waiters resume into the disposed check and settle null instead of hanging.
      for (const resume of gateQueue.splice(0)) resume();
    },
  };
}
