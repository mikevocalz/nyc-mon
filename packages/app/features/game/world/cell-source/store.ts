// Default (web / Node) stores for the cell source. On the web the Cache Storage API is used when the browser
// exposes it, otherwise an explicit in-memory store: nothing persists across reloads there and the module says so.
import type { CellStore } from './types.ts';

/** In-memory store: the Node tests' fake and the web fallback (no persistence). */
export function createMemoryStore(): CellStore {
  const files = new Map<string, Uint8Array>();
  return {
    async list() { return [...files.keys()]; },
    async read(name) { return files.get(name) ?? null; },
    async write(name, bytes) { files.set(name, bytes); },
    async remove(name) { files.delete(name); },
  };
}

interface CacheLike {
  match(req: Request): Promise<Response | undefined>;
  put(req: Request, res: Response): Promise<void>;
  delete(req: Request): Promise<boolean>;
  keys(): Promise<readonly Request[]>;
}
interface CachesLike { open(name: string): Promise<CacheLike> }

const PREFIX = 'https://vd-cell-cache.invalid/';

/** Cache Storage store (web): one entry per cell file, the index persisted as an entry too. */
export function createWebCacheStore(cachesApi: CachesLike, cacheName = 'vd-cells'): CellStore {
  const req = (name: string) => new Request(PREFIX + name);
  const open = () => cachesApi.open(cacheName);
  return {
    async list() {
      const keys = await (await open()).keys();
      return keys.map((r) => r.url.slice(PREFIX.length));
    },
    async read(name) {
      const res = await (await open()).match(req(name));
      return res ? new Uint8Array(await res.arrayBuffer()) : null;
    },
    async write(name, bytes) {
      await (await open()).put(req(name), new Response(bytes.slice().buffer as ArrayBuffer));
    },
    async remove(name) {
      await (await open()).delete(req(name));
    },
  };
}

/** The web default: Cache Storage when the runtime has it, else memory (unpersisted, stated). */
export function createDefaultStore(): CellStore {
  const g = globalThis as { caches?: CachesLike };
  if (typeof g.caches?.open === 'function') return createWebCacheStore(g.caches);
  console.info('[cell-source] no Cache Storage in this runtime; the cell cache is memory-only');
  return createMemoryStore();
}
