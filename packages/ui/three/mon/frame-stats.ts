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
  let stopAt: number | null = null;
  return {
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
      reporter({ frames: dts.length, p50Ms: at(0.5), p95Ms: at(0.95), maxMs: at(1), slow: dts.filter((d) => d > 25).length, pops, clips, closeMs });
      dts = [];
      closeMs = [];
      pops = [];
      clips = [clip];
      started = now();
    },
  };
}
