/**
 * JS renderer submission probe. CPU timings do NOT measure GPU completion or
 * Android UI/compositor frame time; those require device traces.
 * All storage is bounded; no frame data, player identity or coordinates leave
 * this process.
 *
 * Stage attribution (G1): a sample may carry the draw's four sub-stages —
 * scene update, nodeFrame advance, `renderer.render` (three.js traversal +
 * node/binding updates + command encode + queue submit) and `present` (the
 * swapchain hand-off, which can block on buffer availability) — plus the
 * renderer's own counters (`renderer.info.render`) and the drawing-buffer
 * size. `cpuMs` remains the sum of all stages so old and new logs compare.
 */
export interface FrameTimingSample {
  readonly cpuMs: number;
  /** Null for first draw or after a long parked/on-demand gap. */
  readonly intervalMs: number | null;
  /** Scene update() cost: actors, camera, focus refresh. Absent on old probes. */
  readonly updateMs?: number;
  /** advanceNodeFrame(): info.reset + nodeFrame.update. Absent on old probes. */
  readonly nodeMs?: number;
  /** renderer.render() cost. Absent on old probes. */
  readonly renderMs?: number;
  /** context.present() cost. Absent on old probes. */
  readonly presentMs?: number;
  /** renderer.info.render.drawCalls for this frame; absent on old probes. */
  readonly drawCalls?: number;
  /** renderer.info.render.triangles for this frame; absent on old probes. */
  readonly triangles?: number;
  /** Drawing-buffer pixels this frame (canvas.width/height); absent on old probes. */
  readonly bufferW?: number;
  readonly bufferH?: number;
}
/** The probe's writable sample — producers reuse one object per frame, so the fields they fill cannot be readonly. */
export type MutableFrameTimingSample = { -readonly [K in keyof FrameTimingSample]: FrameTimingSample[K] };
export interface FrameStageSummary {
  readonly updateP50Ms: number;
  readonly updateP90Ms: number;
  readonly nodeP50Ms: number;
  readonly nodeP90Ms: number;
  readonly renderP50Ms: number;
  readonly renderP90Ms: number;
  readonly presentP50Ms: number;
  readonly presentP90Ms: number;
  readonly drawCallsP50: number;
  readonly trianglesP50: number;
  readonly trianglesMax: number;
  /** Last seen drawing-buffer size — proof a render-scale step resized the swapchain. */
  readonly bufferW: number;
  readonly bufferH: number;
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
  /** Per-stage attribution; null when every sample came from an old probe. */
  readonly stages: FrameStageSummary | null;
}
export const FRAME_SAMPLE_CAP = 120;
export const ACTIVE_INTERVAL_MAX_MS = 250;
export const SIXTY_HZ_BUDGET_MS = 1000 / 60;
const percentile = (sorted: readonly number[], q: number): number =>
  sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1))] ?? 0;
const valid = (v: number | undefined): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;

export class FrameSampleWindow {
  private readonly cpu = new Float32Array(FRAME_SAMPLE_CAP);
  private readonly update = new Float32Array(FRAME_SAMPLE_CAP);
  private readonly node = new Float32Array(FRAME_SAMPLE_CAP);
  private readonly render = new Float32Array(FRAME_SAMPLE_CAP);
  private readonly present = new Float32Array(FRAME_SAMPLE_CAP);
  private readonly drawCalls = new Float32Array(FRAME_SAMPLE_CAP);
  private readonly tris = new Float32Array(FRAME_SAMPLE_CAP);
  private sampleCount = 0;
  private stageCount = 0;
  private intervalCount = 0;
  private parkedCount = 0;
  private slowCount = 0;
  private worst = 0;
  private trisMax = 0;
  private lastBufferW = 0;
  private lastBufferH = 0;

  /** Returns a report only at the bounded-window boundary; never per frame. */
  push(sample: FrameTimingSample): FrameTimingSummary | null {
    if (!Number.isFinite(sample.cpuMs) || sample.cpuMs < 0 || sample.cpuMs > 60_000) return null;
    if (this.sampleCount >= FRAME_SAMPLE_CAP) this.reset();
    const i = this.sampleCount++;
    this.cpu[i] = sample.cpuMs;
    this.worst = Math.max(this.worst, sample.cpuMs);
    if (valid(sample.renderMs)) {
      // A staged sample: render is the stage every producer always times.
      this.stageCount++;
      this.update[i] = valid(sample.updateMs) ? sample.updateMs : 0;
      this.node[i] = valid(sample.nodeMs) ? sample.nodeMs : 0;
      this.render[i] = sample.renderMs;
      this.present[i] = valid(sample.presentMs) ? sample.presentMs : 0;
      this.drawCalls[i] = valid(sample.drawCalls) ? sample.drawCalls : 0;
      this.tris[i] = valid(sample.triangles) ? sample.triangles : 0;
      this.trisMax = Math.max(this.trisMax, this.tris[i]!);
      if (valid(sample.bufferW)) this.lastBufferW = sample.bufferW;
      if (valid(sample.bufferH)) this.lastBufferH = sample.bufferH;
    }
    const dt = sample.intervalMs;
    if (typeof dt === 'number' && Number.isFinite(dt) && dt > 0) {
      if (dt <= ACTIVE_INTERVAL_MAX_MS) {
        this.intervalCount++;
        if (dt > SIXTY_HZ_BUDGET_MS) this.slowCount++;
      } else this.parkedCount++;
    }
    if (this.sampleCount !== FRAME_SAMPLE_CAP) return null;
    const values = Array.from(this.cpu).sort((a,b)=>a-b);
    let stages: FrameStageSummary | null = null;
    if (this.stageCount > 0) {
      const sorted = (a: Float32Array) => Array.from(a.subarray(0, this.sampleCount)).sort((a,b)=>a-b);
      const u = sorted(this.update); const n = sorted(this.node);
      const r = sorted(this.render); const p = sorted(this.present);
      const dc = sorted(this.drawCalls); const t = sorted(this.tris);
      stages = {
        updateP50Ms: percentile(u, .5), updateP90Ms: percentile(u, .9),
        nodeP50Ms: percentile(n, .5), nodeP90Ms: percentile(n, .9),
        renderP50Ms: percentile(r, .5), renderP90Ms: percentile(r, .9),
        presentP50Ms: percentile(p, .5), presentP90Ms: percentile(p, .9),
        drawCallsP50: percentile(dc, .5),
        trianglesP50: percentile(t, .5), trianglesMax: this.trisMax,
        bufferW: this.lastBufferW, bufferH: this.lastBufferH,
      };
    }
    const report: FrameTimingSummary = {
      samples: this.sampleCount,
      activeIntervals: this.intervalCount,
      parkedIntervals: this.parkedCount,
      cpuP50Ms: percentile(values, .5),
      cpuP90Ms: percentile(values, .9),
      cpuWorstMs: this.worst,
      slowIntervals: this.slowCount,
      stages,
    };
    this.reset();
    return report;
  }

  reset(): void {
    this.sampleCount = 0;
    this.stageCount = 0;
    this.intervalCount = 0;
    this.parkedCount = 0;
    this.slowCount = 0;
    this.worst = 0;
    this.trisMax = 0;
  }
}
