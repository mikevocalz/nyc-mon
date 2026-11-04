/** GPU bytes include every authored mip level. Pages are never resized by the residency manager. */
export interface MaterialPageSpec { id: string; bytes: number }
export interface ResidentMaterialPage { bytes: number; dispose(): void }

/** A per-scene bank; loaders own decoding/upload, this owner bounds pending plus resident GPU allocations. */
export function createMaterialPageBank<T extends ResidentMaterialPage>(options: {
  limitBytes: number;
  pages: readonly MaterialPageSpec[];
  load(id: string, signal: AbortSignal): Promise<T>;
}) {
  const specs = new Map<string, MaterialPageSpec>();
  for (const spec of options.pages) {
    if (!spec.id || specs.has(spec.id) || !Number.isSafeInteger(spec.bytes) || spec.bytes <= 0) throw new Error(`Invalid material page ${spec.id}`);
    specs.set(spec.id, spec);
  }
  if (!Number.isSafeInteger(options.limitBytes) || options.limitBytes <= 0) throw new Error('Invalid material page budget');
  type Entry = { id: string; bytes: number; refs: number; used: number; controller: AbortController; page?: T; error?: unknown; pending: Promise<boolean> };
  const entries = new Map<string, Entry>();
  let bytes = 0, clock = 0, disposed = false;
  function remove(entry: Entry) {
    if (entries.get(entry.id) !== entry) return;
    entries.delete(entry.id); bytes -= entry.bytes;
    entry.controller.abort(); entry.page?.dispose();
  }
  return {
    get bytes() { return bytes; },
    lease(pageIds: readonly string[]) {
      const ids = [...new Set(pageIds)];
      const required = ids.map((id) => {
        const spec = specs.get(id);
        if (!spec) throw new Error(`Unknown authored material page ${id}`);
        return spec;
      });
      if (required.reduce((n, spec) => n + spec.bytes, 0) > options.limitBytes) throw new Error('Authored material cohort exceeds its page budget');
      let held: Entry[] = [], pending: Promise<boolean> | null = null, epoch = 0, error: unknown = null;
      const release = () => {
        epoch++; pending = null;
        for (const entry of held) {
          entry.refs--; entry.used = ++clock;
          if (!entry.refs && !entry.page) remove(entry);
        }
        held = [];
      };
      return {
        get error() { return error; },
        ready: () => !disposed && held.length === ids.length && held.every((entry) => !!entry.page),
        get(id: string): T {
          const entry = held.find((entry) => entry.id === id);
          if (disposed || !entry?.page) throw new Error(`Authored material page ${id} is not resident for this cohort`);
          return entry.page;
        },
        prefetch(): Promise<boolean> {
          if (disposed) return Promise.resolve(false);
          if (pending) return pending;
          if (held.length === ids.length && held.every((entry) => !!entry.page)) return Promise.resolve(true);
          release();
          error = null;
          const generation = epoch;
          const missing = required.filter((spec) => !entries.has(spec.id));
          const needed = missing.reduce((n, spec) => n + spec.bytes, 0);
          const protectedIds = new Set(ids);
          const evictable = [...entries.values()].filter((entry) => !entry.refs && !protectedIds.has(entry.id)).sort((a, b) => a.used - b.used);
          for (const entry of evictable) {
            if (bytes + needed <= options.limitBytes) break;
            remove(entry);
          }
          if (bytes + needed > options.limitBytes) return Promise.resolve(false);
          for (const spec of required) {
            let entry = entries.get(spec.id);
            if (!entry) {
              const controller = new AbortController();
              entry = { ...spec, refs: 0, used: ++clock, controller, pending: Promise.resolve(false) };
              const created = entry;
              entries.set(spec.id, created); bytes += spec.bytes;
              created.pending = Promise.resolve().then(() => options.load(spec.id, controller.signal)).then((page) => {
                if (disposed || entries.get(spec.id) !== created || controller.signal.aborted) { page.dispose(); return false; }
                if (page.bytes !== spec.bytes) { page.dispose(); throw new Error(`Authored material page ${spec.id} GPU byte count mismatch`); }
                created.page = page;
                return true;
              }).catch((cause: unknown) => { created.error = cause; return false; });
            }
            entry.refs++; held.push(entry);
          }
          const waiting = Promise.all(held.map((entry) => entry.pending)).then((ready) => {
            if (disposed || generation !== epoch) return false;
            if (!ready.every(Boolean)) {
              error = held.find((entry) => entry.error !== undefined)?.error ?? new Error('Authored material page load was cancelled');
              release(); return false;
            }
            pending = null;
            return true;
          });
          pending = waiting;
          return waiting;
        },
        release,
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const entry of entries.values()) remove(entry);
    },
  };
}
