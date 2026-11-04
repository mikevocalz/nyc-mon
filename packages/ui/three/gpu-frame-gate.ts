/** Native submission backpressure. Each pending GPU frame owns one bounded slot; input
 * invalidations coalesce without retaining their params or delaying the input loop. */
export interface GpuCompletionQueue { onSubmittedWorkDone(): Promise<void> }
export interface GpuFrameGate {
  begin(): boolean;
  /** True means a latest-frame wake has been retained while the GPU is busy. */
  request(): boolean;
  submitted(): void;
  dispose(): void;
  readonly stats: { submitted: number; completed: number; coalesced: number; inFlight: boolean; inFlightFrames: number; maxInFlight: number; peakInFlight: number; completionMs: number | null };
}

export function createGpuFrameGate(queue: GpuCompletionQueue, options: {
  wake(): void; onError(error: unknown): void; now?(): number; maxInFlight?: 1 | 2;
}): GpuFrameGate {
  if (typeof queue.onSubmittedWorkDone !== 'function') throw new Error('Native WebGPU queue completion is unavailable');
  const maxInFlight = options.maxInFlight ?? 1;
  if (maxInFlight !== 1 && maxInFlight !== 2) throw new Error('GPU frame limit must be one or two');
  let disposed = false, requested = false, claimed = false;
  const now = options.now ?? (() => performance.now());
  const stats: GpuFrameGate['stats'] = { submitted: 0, completed: 0, coalesced: 0, inFlight: false, inFlightFrames: 0, maxInFlight, peakInFlight: 0, completionMs: null };
  const fail = (error: unknown) => {
    if (disposed) return;
    disposed = true; requested = false; claimed = false; stats.inFlight = false; stats.inFlightFrames = 0;
    options.onError(error);
  };
  return {
    stats,
    begin() {
      if (disposed) return false;
      if (claimed || stats.inFlightFrames >= maxInFlight) { requested = true; stats.coalesced++; return false; }
      claimed = true; stats.inFlight = true; stats.inFlightFrames++;
      stats.peakInFlight = Math.max(stats.peakInFlight, stats.inFlightFrames); return true;
    },
    request() {
      if (disposed) return true;
      if (stats.inFlightFrames < maxInFlight) return false;
      requested = true; stats.coalesced++; return true;
    },
    submitted() {
      if (disposed) return;
      if (!claimed) throw new Error('GPU frame slot was not acquired exactly once');
      claimed = false; stats.submitted++;
      const start = now();
      let done: Promise<void>;
      try { done = queue.onSubmittedWorkDone(); } catch (error) { fail(error); return; }
      void done.then(() => {
        if (disposed) return;
        stats.inFlightFrames--; stats.inFlight = stats.inFlightFrames > 0; stats.completed++;
        stats.completionMs = Math.max(0, now() - start);
        if (requested) { requested = false; options.wake(); }
      }, fail);
    },
    dispose() { disposed = true; requested = false; claimed = false; stats.inFlight = false; stats.inFlightFrames = 0; },
  };
}
