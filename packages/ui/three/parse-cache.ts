import { registerReleasable, type ReleaseCount } from './release.ts';

/** One stage's hold on a shared parse. `release` is idempotent. */
export interface ParseLease<T> {
  readonly value: Promise<T>;
  release(): void;
}

export interface ParseCacheOptions<T> {
  /** How long a parse outlives its last user, ms (0: freed at once). A route change picks it straight back up. */
  readonly keepMs: number;
  /** Frees a parse nothing uses any more. */
  readonly dispose: (value: T) => void;
}

interface Entry<T> {
  readonly promise: Promise<T>;
  refs: number;
  drop: ReturnType<typeof setTimeout> | null;
  /** Taken out of the cache by `releaseAll` while still leased: freed at its last release. */
  evicted: boolean;
}

/**
 * GLB parses shared by every stage that shows the same asset (the H-Lynk's
 * glass, HatchEgg3D, MonStage, the hatch sequence), keyed by asset: one parse
 * however many stages mount it, freed after its last user. Raw GLB bytes are
 * cached only until their parse lands (a preload warms them ahead of the
 * first stage); after that the parse is the only copy.
 */
export class SharedParseCache<T> {
  private readonly entries = new Map<string, Entry<T>>();
  private readonly bytes = new Map<string, Promise<ArrayBuffer>>();
  private readonly options: ParseCacheOptions<T>;
  readonly name: string;

  constructor(name: string, options: ParseCacheOptions<T>) {
    this.name = name;
    this.options = options;
    registerReleasable(this);
  }

  /** The asset's bytes: the warmed fetch when there is one, else a new one. A failed fetch leaves the cache. */
  bytesFor(key: string, fetch: () => Promise<ArrayBuffer>): Promise<ArrayBuffer> {
    const cached = this.bytes.get(key);
    if (cached) return cached;
    const pending: Promise<ArrayBuffer> = fetch().catch((error: unknown) => {
      if (this.bytes.get(key) === pending) this.bytes.delete(key);
      throw error;
    });
    this.bytes.set(key, pending);
    return pending;
  }

  /** Warms the bytes ahead of the first stage. A no-op while the asset is parsed (or parsing). */
  preload(key: string, fetch: () => Promise<ArrayBuffer>): void {
    if (this.entries.has(key)) return;
    this.bytesFor(key, fetch).catch(() => undefined);
  }

  acquire(key: string, parse: () => Promise<T>): ParseLease<T> {
    let entry = this.entries.get(key);
    if (!entry) {
      const promise = parse();
      const created: Entry<T> = { promise, refs: 0, drop: null, evicted: false };
      entry = created;
      this.entries.set(key, created);
      promise.then(
        // Parsed: the bytes have done their job and the parse holds what it needs.
        () => {
          if (this.entries.get(key) === created) this.bytes.delete(key);
        },
        // A failed parse leaves the cache, so a remount retries instead of replaying the error.
        () => {
          if (this.entries.get(key) !== created) return;
          this.entries.delete(key);
          this.bytes.delete(key);
        },
      );
    }
    if (entry.drop !== null) {
      clearTimeout(entry.drop);
      entry.drop = null;
    }
    entry.refs += 1;
    const held = entry;
    let released = false;
    return {
      value: held.promise,
      release: () => {
        if (released) return;
        released = true;
        this.letGo(key, held);
      },
    };
  }

  /** Drops every entry: unused ones are freed now, leased ones at their last release. Clears the warmed bytes. */
  releaseAll(): ReleaseCount {
    let freed = 0;
    let deferred = 0;
    for (const [key, entry] of this.entries) {
      this.entries.delete(key);
      if (entry.drop !== null) {
        clearTimeout(entry.drop);
        entry.drop = null;
      }
      if (entry.refs > 0) {
        entry.evicted = true;
        deferred += 1;
      } else {
        this.free(entry);
        freed += 1;
      }
    }
    this.bytes.clear();
    return { freed, deferred };
  }

  /** What the cache holds now, for tests and diagnostics. */
  stats(): { readonly parsed: number; readonly bytes: number; readonly keys: readonly string[] } {
    return { parsed: this.entries.size, bytes: this.bytes.size, keys: [...this.entries.keys()] };
  }

  private letGo(key: string, entry: Entry<T>): void {
    entry.refs -= 1;
    if (entry.refs > 0) return;
    if (entry.evicted) {
      this.free(entry);
      return;
    }
    const drop = () => {
      entry.drop = null;
      if (this.entries.get(key) !== entry || entry.refs > 0) return;
      this.entries.delete(key);
      this.free(entry);
    };
    if (this.options.keepMs <= 0) drop();
    else entry.drop = setTimeout(drop, this.options.keepMs);
  }

  private free(entry: Entry<T>): void {
    entry.promise.then((value) => this.options.dispose(value), () => undefined);
  }
}
