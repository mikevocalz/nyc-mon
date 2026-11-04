import { boxDistance } from '../../cells/cell-rules.ts';
import { cellInStartSet, cellWanted } from '../../cells/cell-demand.ts';
import type { Vec3 } from '../../cells/cell-stream.ts';
import type { VdStreamLayer } from '../types.ts';
import type { SurfaceCohortPlan } from './surface-layers.ts';

/** Select whole cohorts with the streamer's real demand and START rules, nearest first. */
export function selectSourceCohorts(plan: SurfaceCohortPlan, options: {
  camera: Vec3; k: number; layer: VdStreamLayer; residentRadius: number;
  screenErrorPx: number; hysteresis: number; startRadius?: number;
  pinned?(cx: number, cz: number): boolean;
}): number[] {
  return [...plan].map(([id, group]) => {
    const distance = boxDistance(group.bounds, options.camera.x, options.camera.y, options.camera.z);
    const first = group.cells[0]!;
    const pinned = options.layer.pin !== false && options.pinned?.(first.cx, first.cz) === true;
    const wanted = pinned || (distance <= Math.max(options.residentRadius, options.layer.reachM ?? 0) && cellWanted({
      distance, errorM: options.layer.errorM, k: options.k, reachM: options.layer.reachM,
      screenErrorPx: options.screenErrorPx, hysteresis: options.hysteresis, rise: true,
    }));
    return { id, distance, selected: options.startRadius === undefined ? wanted : cellInStartSet({ wanted, pinned, distance, startRadius: options.startRadius }) };
  }).filter(item => item.selected).sort((a,b) => a.distance-b.distance || a.id-b.id).map(item => item.id);
}

/** Serial, scene-owned activation. Metadata alone never acquires pages; completed handles own only registered layers. */
export function createSourceActivation(options: {
  activate(id: number, signal: AbortSignal): Promise<{dispose(): void; registered?: boolean}>;
  wake(): void;
}) {
  type Entry = { controller: AbortController; pending: Promise<void>; handle?: {dispose(): void; registered?: boolean} };
  const entries = new Map<number, Entry>();
  let tail = Promise.resolve(), disposed = false;
  return {
    get busy(){return [...entries.values()].some(entry=>!entry.handle);},
    /** Replacing demand aborts pending offscreen work. Registered layers retain ordinary streamer eviction ownership. */
    request(ids: readonly number[]): Promise<void> {
      if (disposed) return Promise.reject(aborted());
      const wanted = new Set(ids);
      for (const [id, entry] of entries) if (!wanted.has(id) && !entry.handle) {
        entry.controller.abort(); entries.delete(id);
      }
      const pending = ids.map(id => {
        const existing = entries.get(id);
        if (existing) return existing.pending;
        const controller = new AbortController();
        const entry: Entry = { controller, pending: Promise.resolve() };
        entry.pending = tail.catch(() => {}).then(async () => {
          if (disposed || controller.signal.aborted) throw aborted();
          if(entries.get(id)!==entry && entries.get(id)?.handle)return;
          const handle = await options.activate(id, controller.signal);
          if (disposed || ((controller.signal.aborted || entries.get(id) !== entry) && !handle.registered)) { handle.dispose(); throw aborted(); }
          // Registration is a synchronous commit into the stream. If demand changed in the
          // resolving microtask, retain that committed owner; normal stream eviction follows.
          entries.set(id,entry);
          entry.handle = handle;
          options.wake();
        }).catch((error: unknown) => {
          if (entries.get(id) === entry) entries.delete(id);
          throw error;
        });
        // Observe immediately even when newer demand supersedes its requesting caller.
        void entry.pending.catch(() => {});
        entries.set(id, entry); tail = entry.pending;
        return entry.pending;
      });
      return Promise.all(pending).then(() => {});
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const entry of entries.values()) { entry.controller.abort(); entry.handle?.dispose(); }
      entries.clear();
    },
  };
}
function aborted() { const error = new Error('Source cohort activation aborted'); error.name = 'AbortError'; return error; }
