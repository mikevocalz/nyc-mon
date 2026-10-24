import type { CallToolResult } from '@modelcontextprotocol/client';
import { HATCH_START_LOGGER, scheduleHatchSound, type HatchStartReport } from '@acme/ui/three/mon/hatch-sound';
import { BEATS } from '@acme/ui/three/mon/hatch-timeline';

/**
 * The hatch's sound, played by the host page. On the voice path ("Hatch my
 * egg") the view's iframe never had a gesture, so its AudioContext stays
 * suspended and the hatch would be silent; this page had one (Talk, Send, the
 * mic), so it plays the same synth (hatch-sound.ts) on the same timeline.
 *
 * Alignment: the view reports the moment its sequence starts as an MCP
 * logging notification (`notifications/message`, logger HATCH_START_LOGGER),
 * with whether its own audio runs. If it does (the Hatch button was a tap in
 * the frame), the view plays and this stays silent: one sound, never two.
 * Otherwise this schedules every cue from the view's start, back-dated by the
 * report's own delay. Each fresh hatch_egg result arms one playback.
 */

/** The parts of an AudioContext the host uses (a fake one in tests). */
export type HostAudio = BaseAudioContext & { resume(): Promise<void> };

export interface HostHatchDeps {
  /** The page's AudioContext, made on first use; null where WebAudio is missing. */
  readonly audio: () => HostAudio | null;
  /** "Read replies aloud": off means no hatch sound either. */
  readonly soundOn: () => boolean;
  readonly reducedMotion: () => boolean;
  /** Scales the Mon's voice: 1 restores it. */
  readonly duckSpeech: (level: number) => void;
  readonly setTimer?: (fn: () => void, ms: number) => unknown;
  readonly clearTimer?: (handle: unknown) => void;
}

export type HatchOutcome = 'host' | 'view' | 'skipped';

export interface HostHatchSound {
  /** A fresh hatch result reached this view: the next start report may play. */
  arm(): void;
  onViewStart(report: HatchStartReport): Promise<HatchOutcome>;
  dispose(): void;
}

/** The Mon's voice level under the white-out's whoosh. */
export const DUCK_LEVEL = 0.3;
/** How long an armed hatch waits for the view's start report (a slow model load in software GL). */
const ARM_MS = 60_000;
/** The resume wait the view reports is at most 150 ms; anything past a second is not believed. */
const MAX_ELAPSED_MS = 1000;

/** hatch_egg's result for an egg that hatched just now (not a repeat call, not an error). */
export function isFreshHatch(toolName: string, result: Pick<CallToolResult, 'structuredContent' | 'isError'> | undefined): boolean {
  if (toolName !== 'hatch_egg' || !result || result.isError) return false;
  const sc = result.structuredContent as { hatching?: unknown; alreadyHatched?: unknown } | undefined;
  return sc?.hatching === true && sc.alreadyHatched !== true;
}

/** The view's hatch-start report out of a logging notification, or null for any other log. */
export function parseHatchStart(params: { readonly level?: string; readonly logger?: string; readonly data?: unknown }): HatchStartReport | null {
  if (params.logger !== HATCH_START_LOGGER) return null;
  const d = params.data as { event?: unknown; sound?: unknown; elapsedMs?: unknown } | null | undefined;
  if (typeof d !== 'object' || d === null || d.event !== 'hatch-start' || typeof d.sound !== 'boolean') return null;
  const elapsed = typeof d.elapsedMs === 'number' && Number.isFinite(d.elapsedMs) ? d.elapsedMs : 0;
  return { sound: d.sound, elapsedMs: Math.min(MAX_ELAPSED_MS, Math.max(0, elapsed)) };
}

export function createHostHatchSound(deps: HostHatchDeps): HostHatchSound {
  const setTimer = deps.setTimer ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const clearTimer = deps.clearTimer ?? ((h: unknown) => clearTimeout(h as ReturnType<typeof setTimeout>));
  let armedAt: number | null = null;
  let playing: { cancel(): void } | null = null;
  let timers: unknown[] = [];
  let ducked = false;

  const stop = () => {
    const restore = ducked || timers.length > 0;
    playing?.cancel();
    playing = null;
    for (const t of timers) clearTimer(t);
    timers = [];
    if (restore) {
      ducked = false;
      deps.duckSpeech(1);
    }
  };

  return {
    arm() {
      armedAt = Date.now();
    },
    async onViewStart(report) {
      const received = globalThis.performance?.now() ?? Date.now();
      if (armedAt === null || Date.now() - armedAt > ARM_MS) return 'skipped';
      armedAt = null;
      if (report.sound) return 'view';
      if (!deps.soundOn()) return 'skipped';
      const ctx = deps.audio();
      if (!ctx) return 'skipped';
      if (ctx.state !== 'running') {
        try {
          await Promise.race([ctx.resume(), new Promise((r) => setTimeout(r, 150))]);
        } catch {
          // Stays suspended: no sound.
        }
      }
      if (ctx.state !== 'running') return 'skipped';
      stop();
      const lagMs = report.elapsedMs + ((globalThis.performance?.now() ?? Date.now()) - received);
      const reduced = deps.reducedMotion();
      const startAt = ctx.currentTime - lagMs / 1000;
      playing = scheduleHatchSound(ctx, ctx.destination, startAt, reduced);
      if (!reduced) {
        // The whoosh fills the white-out; the voice steps back under it and returns as the white clears.
        const from = BEATS.whiteout[0] * 1000 - lagMs;
        const to = BEATS.whiteFade[1] * 1000 - lagMs;
        if (to > 0) {
          timers.push(
            setTimer(() => {
              ducked = true;
              deps.duckSpeech(DUCK_LEVEL);
            }, Math.max(0, from)),
            setTimer(() => {
              ducked = false;
              deps.duckSpeech(1);
            }, to),
          );
        }
      }
      return 'host';
    },
    dispose() {
      armedAt = null;
      stop();
    },
  };
}

let pageAudio: AudioContext | null = null;

/** The page's one AudioContext for hatch sounds, made on first use (after the page's first gesture it can start). */
export function pageAudioContext(): HostAudio | null {
  if (pageAudio) return pageAudio;
  const Ctx = (globalThis as { AudioContext?: typeof AudioContext }).AudioContext;
  if (!Ctx) return null;
  try {
    pageAudio = new Ctx();
  } catch {
    return null;
  }
  return pageAudio;
}
