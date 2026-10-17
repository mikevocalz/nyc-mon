/**
 * JS renderer submission probe. CPU timings do NOT measure GPU completion or
 * Android UI/compositor frame time; those require device traces.
 * All storage is bounded; no frame data, player identity or coordinates leave
 * this process.
 */
export interface FrameTimingSample {
  readonly cpuMs: number;
  /** Null for first draw or after a long parked/on-demand gap. */
  readonly intervalMs: number | null;
}
export interface FrameTimingSummary {
  readonly samples: number;
  readonly activeIntervals: number;
  readonly parkedIntervals: number;
  readonly cpuP50Ms: number;
  readonly cpuP90Ms: number;
  readonly cpuWorstMs: number;
  /** Gaps past one 60 Hz frame while drawing, not independently verified missed vsyncs. */
  readonly slowIntervals: number;
}
export const FRAME_SAMPLE_CAP = 120;
export const ACTIVE_INTERVAL_MAX_MS = 250;
export const SIXTY_HZ_BUDGET_MS = 1000 / 60;
const percentile = (sorted: readonly number[], q: number): number =>
  sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1))] ?? 0;

export class FrameSampleWindow {
  private readonly cpu = new Float32Array(FRAME_SAMPLE_CAP);
  private sampleCount = 0;
  private intervalCount = 0;
  private parkedCount = 0;
  private slowCount = 0;
  private worst = 0;

  /** Returns a report only at the bounded-window boundary; never per frame. */
  push(sample: FrameTimingSample): FrameTimingSummary | null {
    if (!Number.isFinite(sample.cpuMs) || sample.cpuMs < 0 || sample.cpuMs > 60_000) return null;
    if (this.sampleCount >= FRAME_SAMPLE_CAP) this.reset();
    this.cpu[this.sampleCount++] = sample.cpuMs;
    this.worst = Math.max(this.worst, sample.cpuMs);
    const dt = sample.intervalMs;
    if (typeof dt === 'number' && Number.isFinite(dt) && dt > 0) {
      if (dt <= ACTIVE_INTERVAL_MAX_MS) {
        this.intervalCount++;
        if (dt > SIXTY_HZ_BUDGET_MS) this.slowCount++;
      } else this.parkedCount++;
    }
    if (this.sampleCount !== FRAME_SAMPLE_CAP) return null;
    const values = Array.from(this.cpu).sort((a, b) => a - b);
    const report: FrameTimingSummary = {
      samples: this.sampleCount,
      activeIntervals: this.intervalCount,
      parkedIntervals: this.parkedCount,
      cpuP50Ms: percentile(values, .5),
      cpuP90Ms: percentile(values, .9),
      cpuWorstMs: this.worst,
      slowIntervals: this.slowCount,
    };
    this.reset();
    return report;
  }

  reset(): void {
    this.sampleCount = 0;
    this.intervalCount = 0;
    this.parkedCount = 0;
    this.slowCount = 0;
    this.worst = 0;
  }
}
