/** Only completed work advances START; no clock or synthetic heartbeat lives here. */
export type InitialAssetProgress =
  | { kind: 'source-plan'; pages: readonly string[]; cells: readonly string[]; cohorts: readonly number[] }
  | { kind: 'page-ready' | 'cell-ready'; id: string }
  | { kind: 'compile-start' | 'compile-ready'; id: number };

export interface SourceCompileProgress { kind: 'templates' | 'scene'; fraction: number }

/** Reserve the final tenth of world construction for real initial prerequisites. */
export function createSceneBuildProgress(report?: (fraction: number) => void, signal?: AbortSignal) {
  const units = new Map<string, number>([['auxiliary-scene', 0], ['ready-gate', 0]]);
  let last = -1, cpu = 0, assetsStarted = false, finished = false, planned = false;
  let activeCompile: string | undefined;
  const live = () => !finished && !signal?.aborted;
  const emit = (fraction: number) => {
    if (!live() || !Number.isFinite(fraction) || fraction <= last) return;
    last = fraction; report?.(fraction);
  };
  const publish = () => {
    if (!assetsStarted) return;
    let completed = 0; for (const value of units.values()) completed += value;
    emit(0.9 + 0.1 * completed / units.size);
  };
  const advance = (key: string, fraction: number) => {
    if (!live() || !Number.isFinite(fraction)) return;
    const old = units.get(key);
    if (old === undefined) return; // Later streamed demand is outside this START plan.
    const next = Math.min(1, Math.max(0, fraction));
    if (next <= old) return;
    units.set(key, next); publish();
  };
  return {
    cpu(fraction: number) {
      if (!live() || !Number.isFinite(fraction)) return;
      const next = Math.min(1, Math.max(0, fraction));
      if (next <= cpu) return;
      cpu = next; if (!assetsStarted) emit(cpu * 0.9);
    },
    /** The numeric scene generator completed; accumulated real asset work may now be published. */
    beginAssets() {
      if (!live() || assetsStarted) return;
      cpu = 1; emit(0.9); assetsStarted = true; publish();
    },
    asset(event: InitialAssetProgress) {
      if (!live()) return;
      switch (event.kind) {
        case 'source-plan':
          if (planned) return;
          planned = true;
          for (const id of event.pages) units.set(`page:${id}`, 0);
          for (const id of event.cells) units.set(`cell:${id}`, 0);
          for (const id of event.cohorts) units.set(`cohort:${id}`, 0);
          publish();
          break;
        case 'page-ready': advance(`page:${event.id}`, 1); break;
        case 'cell-ready': advance(`cell:${event.id}`, 1); break;
        case 'compile-start': {
          const key = `cohort:${event.id}`;
          activeCompile = units.has(key) ? key : undefined;
          break;
        }
        case 'compile-ready':
          advance(`cohort:${event.id}`, 1);
          if (activeCompile === `cohort:${event.id}`) activeCompile = undefined;
          break;
      }
    },
    compile(event: SourceCompileProgress) {
      if (event.kind === 'scene') advance('auxiliary-scene', event.fraction);
      else if (activeCompile) advance(activeCompile, event.fraction);
    },
    /** Only the owning ready promise can complete the gate; loaded/total=1 alone cannot reveal the scene. */
    finish() {
      if (!live()) return;
      assetsStarted = true;
      // Resolution is the authoritative completion of every selected initial
      // prerequisite, including a cache hit that required no new IO callback.
      for (const key of units.keys()) units.set(key, 1);
      publish(); finished = true; activeCompile = undefined;
    },
    dispose() { finished = true; activeCompile = undefined; },
  };
}
