/**
 * Frame timing for a running MonModel3D, for finding stutter. A view
 * registers one reporter (it forwards to its host); with none registered the
 * model collects nothing.
 *
 * Every window it reports the frame intervals and the frames where the root
 * jumped: a root heading or step that moves further in one frame than the
 * idle engine ever eases it is a visible pop, whatever the frame rate.
 */

export interface FrameStats {
  readonly frames: number;
  readonly p50Ms: number;
  readonly p95Ms: number;
  readonly maxMs: number;
  /** Frames over 25 ms (a dropped frame at 60 Hz or worse). */
  readonly slow: number;
  /** Root yaw (rad) or step (box units) jumps, with the clip playing when each happened. */
  readonly pops: readonly { readonly yaw: number; readonly x: number; readonly clip: string }[];
  readonly clips: readonly string[];
  /** Per stop cue: ms from the stop arriving until the jaw read shut. */
  readonly closeMs: readonly number[];
  /**
   * Frames where the head jumped on screen: a step of `px` CSS pixels while
   * the median step was `medianPx`, with the clip and its time. A pose pop
   * (a clip whose loop does not meet, a hard cut) shows here even at 120 fps.
   */
  readonly jumps: readonly { readonly px: number; readonly medianPx: number; readonly clip: string; readonly clipT: number }[];
  /** What happened when, ms since the window began: head pops (`pop`), cues and action changes. */
  readonly events: readonly (readonly [number, string])[];
}

let reporter: ((stats: FrameStats) => void) | null = null;

export function setFrameStatsReporter(fn: ((stats: FrameStats) => void) | null): void {
  reporter = fn;
}

/** A yaw change this big in one frame is faster than any eased turn (about 9° at 60 Hz). */
const YAW_POP = 0.15;
const X_POP = 0.05;
const WINDOW_MS = 3000;

export function createFrameStats(now: () => number = () => performance.now()) {
  let dts: number[] = [];
  let pops: { yaw: number; x: number; clip: string }[] = [];
  let clips: string[] = [];
  let lastYaw: number | null = null;
  let lastX = 0;
  let started = now();
  let closeMs: number[] = [];
  let steps: number[] = [];
  let jumps: { px: number; medianPx: number; clip: string; clipT: number }[] = [];
  let lastHead: [number, number] | null = null;
  let events: [number, string][] = [];
  let lastStep: [number, number] | null = null;

  let stopAt: number | null = null;
  return {
    /** Something the head might react to: a cue, an action starting. */
    note(what: string) {
      if (reporter) events.push([Math.round(now() - started), what]);
    },
    /** The view got a stop cue (or the utterance ran out). */
    stopped() {
      if (reporter) stopAt = now();
    },
    /** The jaw's opening this frame, 0..1 of the speech range. */
    mouth(open: number) {
      if (stopAt !== null && open < 0.02) {
        closeMs.push(Math.round(now() - stopAt));
        stopAt = null;
      }
    },
    /** The head's screen position this frame (CSS px), with the clip time. */
    head(px: number, py: number, clip: string, clipT: number) {
      if (!reporter) return;
      if (lastHead) {
        const v: [number, number] = [px - lastHead[0], py - lastHead[1]];
        if (lastStep && Math.hypot(v[0] - lastStep[0], v[1] - lastStep[1]) > 1.5) events.push([Math.round(now() - started), `pop ${Math.hypot(v[0] - lastStep[0], v[1] - lastStep[1]).toFixed(1)}px ${clip}@${clipT.toFixed(2)}`]);
        lastStep = v;
        const step = Math.hypot(px - lastHead[0], py - lastHead[1]);
        const sorted = [...steps].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)] ?? step;
        if (steps.length > 30 && step > 3 && step > 6 * Math.max(median, 0.2)) jumps.push({ px: +step.toFixed(1), medianPx: +median.toFixed(2), clip, clipT: +clipT.toFixed(2) });
        steps.push(step);
        if (steps.length > 240) steps.shift();
      }
      lastHead = [px, py];
    },
    frame(dtMs: number, yaw: number, x: number, clip: string) {
      if (!reporter) return;
      dts.push(dtMs);
      if (lastYaw !== null) {
        const dy = Math.abs(Math.atan2(Math.sin(yaw - lastYaw), Math.cos(yaw - lastYaw)));
        const dx = Math.abs(x - lastX);
        if (dy > YAW_POP || dx > X_POP) pops.push({ yaw: +dy.toFixed(3), x: +dx.toFixed(3), clip });
      }
      lastYaw = yaw;
      lastX = x;
      if (clips.at(-1) !== clip) clips.push(clip);
      if (now() - started < WINDOW_MS) return;
      const sorted = [...dts].sort((a, b) => a - b);
      const at = (q: number) => +(sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] ?? 0).toFixed(1);
      reporter({ frames: dts.length, p50Ms: at(0.5), p95Ms: at(0.95), maxMs: at(1), slow: dts.filter((d) => d > 25).length, pops, clips, closeMs, jumps, events });
      jumps = [];
      events = [];
      dts = [];
      closeMs = [];
      pops = [];
      clips = [clip];
      started = now();
    },
  };
}

/** A pending burst capture of rendered frames (a dev aid for seeing motion frame by frame). */
let capture: { every: number; left: number; seen: number; size: number; frames: string[]; done: (frames: string[]) => void } | null = null;

/** Captures `count` rendered frames, one every `every` frames, `size` px square, as JPEG data URLs. */
export function requestFrameCapture(count: number, every: number, size: number, done: (frames: string[]) => void): void {
  capture = { every: Math.max(1, every), left: count, seen: 0, size, frames: [], done };
}

/** Called right after each render, while the drawing buffer still holds the frame. */
export function captureFrame(canvas: HTMLCanvasElement): void {
  const c = capture;
  if (!c) return;
  if (c.seen++ % c.every !== 0) return;
  const out = document.createElement('canvas');
  out.width = out.height = c.size;
  const ctx = out.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#f3f4f2';
  ctx.fillRect(0, 0, c.size, c.size);
  ctx.drawImage(canvas, 0, 0, c.size, c.size);
  c.frames.push(out.toDataURL('image/jpeg', 0.7));
  if (--c.left <= 0) {
    capture = null;
    c.done(c.frames);
  }
}

/** A pending probe: per-frame readings of named values, to find one that flips frame to frame. */
let probe: { left: number; rows: Record<string, number>[]; done: (rows: Record<string, number>[]) => void } | null = null;

export function requestProbe(count: number, done: (rows: Record<string, number>[]) => void): void {
  probe = { left: count, rows: [], done };
}

export function probing(): boolean {
  return probe !== null;
}

export function probeFrame(row: Record<string, number>): void {
  const p = probe;
  if (!p) return;
  p.rows.push(row);
  if (--p.left <= 0) {
    probe = null;
    p.done(p.rows);
  }
}
