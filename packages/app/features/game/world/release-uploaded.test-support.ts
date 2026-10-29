// Traps reads of the empty arrays world/release-uploaded.ts installs. A
// released attribute or texture keeps an empty typed array of its old type;
// three may still read its constructor and BYTES_PER_ELEMENT (both on the
// prototype chain, untouched here), but any read of its contents or size
// means something wanted the released data. Each released array gets own
// accessors over the element and size properties that count those reads.
import { setReleaseObserver } from './release-uploaded.ts';

/** Properties that only a reader of the data (not of its type) touches. */
const TRAPPED = [
  'length', 'byteLength', 'byteOffset', 'buffer', 'subarray', 'slice', 'set', 'at', 'fill', 'forEach', 'map',
  'join', 'toString', 'values', 'entries', 'keys', 'indexOf', 'reduce', 'every', 'some', 'copyWithin',
] as const;

export interface ReleasedReadTrap {
  /** Reads counted while the trap is active, by property. */
  readonly reads: Map<string, number>;
  /** Arrays released since install. */
  readonly released: number;
  /** Counts reads only between `resume` and `pause` (the harness's own measuring pauses it). */
  pause(): void;
  resume(): void;
  /** Detaches the observer; trapped arrays stay trapped but stop counting. */
  uninstall(): void;
  total(): number;
}

export function trapReleasedReads(): ReleasedReadTrap {
  const reads = new Map<string, number>();
  let active = true;
  let released = 0;
  setReleaseObserver((array) => {
    released++;
    const proto = Object.getPrototypeOf(array) as Record<string, unknown>;
    for (const key of TRAPPED) {
      const descriptor = (() => {
        for (let p: object | null = proto; p; p = Object.getPrototypeOf(p)) {
          const d = Object.getOwnPropertyDescriptor(p, key);
          if (d) return d;
        }
        return undefined;
      })();
      if (!descriptor) continue;
      Object.defineProperty(array, key, {
        configurable: true,
        get() {
          if (active) {
            reads.set(key, (reads.get(key) ?? 0) + 1);
          }
          return descriptor.get ? descriptor.get.call(array) : descriptor.value;
        },
      });
    }
  });
  return {
    reads,
    get released() { return released; },
    pause() { active = false; },
    resume() { active = true; },
    uninstall() { active = false; setReleaseObserver(null); },
    total() { let n = 0; for (const v of reads.values()) n += v; return n; },
  };
}
