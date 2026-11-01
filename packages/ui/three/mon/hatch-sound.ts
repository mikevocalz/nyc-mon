import { soundEnabled } from '../../device-preferences';
import { soundCues, type SoundCue } from './hatch-timeline.ts';

/**
 * The hatch's sounds, synthesized on the spot with WebAudio: nothing is
 * sampled or borrowed from any game. Crack: a short band-passed noise click.
 * Tick: a smaller one. Shimmer: a soft rising triad through the tension.
 * Whoosh: filtered noise swelling under the white-out. Chime: three bell
 * notes (C6, E6, G6) as the Baby resolves into colour.
 *
 * Browsers start an AudioContext suspended until the page has had a user
 * gesture. Inside a sandboxed MCP Apps iframe that means the touch path (the
 * Hatch button is a tap in the frame) has sound and the voice path usually
 * does not; `start` resolves false then and every cue is a no-op. The host
 * page had the gesture on the voice path (Talk, Send, the mic), so it plays
 * the same synth from the same timeline: `scheduleHatchSound` takes the
 * host's own AudioContext and the moment the view started the sequence.
 * `setHatchStartReporter` is how a view tells its host which of the two
 * plays, so the sound never plays twice.
 */
export interface HatchSound {
  /** Resolves whether sound can play. */
  start(): Promise<boolean>;
  play(cue: SoundCue): void;
  dispose(): void;
}

/** The output level every hatch sound plays at. */
export const HATCH_SOUND_LEVEL = 0.18;

/** What a view reports as the hatch sequence starts. */
export interface HatchStartReport {
  /** Whether this view's own AudioContext is running, so the view plays the sound itself. */
  readonly sound: boolean;
  /** Milliseconds from the sequence's start to this report (the resume wait). */
  readonly elapsedMs: number;
}

/** The MCP logging `logger` a view's hatch-start report travels under (notifications/message). */
export const HATCH_START_LOGGER = 'nyc-mon/hatch';

let reporter: ((report: HatchStartReport) => void) | null = null;

/**
 * Registers the one function told when a hatch sequence starts in this
 * document (a view forwards it to its host). Null unregisters.
 */
export function setHatchStartReporter(fn: ((report: HatchStartReport) => void) | null): void {
  reporter = fn;
}

function noise(c: BaseAudioContext, seconds: number): AudioBufferSourceNode {
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * seconds), c.sampleRate);
  const d = buf.getChannelData(0);
  let seed = 7;
  for (let i = 0; i < d.length; i++) {
    seed = (seed * 16807) % 2147483647;
    d[i] = (seed / 2147483647) * 2 - 1;
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  return src;
}

function envelope(c: BaseAudioContext, at: number, attack: number, hold: number, release: number, peak: number): GainNode {
  const g = c.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(peak, at + attack);
  g.gain.setValueAtTime(peak, at + attack + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, at + attack + hold + release);
  return g;
}

/** Plays one cue on `c` into `out`, starting at context time `at`. The single synth both the view and the host use. */
export function playHatchCue(c: BaseAudioContext, out: AudioNode, cue: SoundCue, at: number): void {
  if (cue === 'crack' || cue === 'tick') {
    const src = noise(c, 0.12);
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = cue === 'crack' ? 2600 : 3800;
    bp.Q.value = 2.5;
    src.connect(bp).connect(envelope(c, at, 0.002, 0.01, cue === 'crack' ? 0.09 : 0.05, cue === 'crack' ? 1 : 0.5)).connect(out);
    src.start(at);
  } else if (cue === 'shimmer') {
    [523.25, 659.25, 783.99].forEach((hz, i) => {
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(hz, at);
      o.frequency.linearRampToValueAtTime(hz * 1.5, at + 0.83);
      o.connect(envelope(c, at + i * 0.05, 0.3, 0.3, 0.3, 0.12)).connect(out);
      o.start(at + i * 0.05);
      o.stop(at + 1.2);
    });
  } else if (cue === 'whoosh') {
    const src = noise(c, 0.9);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(400, at);
    lp.frequency.exponentialRampToValueAtTime(5000, at + 0.35);
    src.connect(lp).connect(envelope(c, at, 0.3, 0.05, 0.5, 0.6)).connect(out);
    src.start(at);
  } else {
    [1046.5, 1318.5, 1568].forEach((hz, i) => {
      const note = at + i * 0.14;
      const o = c.createOscillator();
      o.type = 'triangle';
      o.frequency.value = hz;
      o.connect(envelope(c, note, 0.008, 0.04, i === 2 ? 1.1 : 0.45, 0.45)).connect(out);
      o.start(note);
      o.stop(note + 1.4);
    });
  }
}

/** A cue that starts this far in the past still plays (now); anything later behind is dropped. */
const LATE_SECONDS = 0.08;

/**
 * Schedules the whole hatch on `c`: every cue of `soundCues(reducedMotion)`
 * at `startAt` (context seconds, when the view's sequence started) plus its
 * offset, through a gain at HATCH_SOUND_LEVEL. A cue already more than a few
 * frames past is skipped rather than played late. Returns the cancel.
 */
export function scheduleHatchSound(
  c: BaseAudioContext,
  destination: AudioNode,
  startAt: number,
  reducedMotion: boolean,
): { readonly scheduled: readonly { readonly cue: SoundCue; readonly at: number }[]; cancel(): void } {
  const out = c.createGain();
  out.gain.value = HATCH_SOUND_LEVEL;
  out.connect(destination);
  const scheduled: { cue: SoundCue; at: number }[] = [];
  // Sound off in Settings (M19): schedule nothing; the gain stays silent.
  if (!soundEnabled()) return { scheduled, cancel() { out.disconnect(); } };
  for (const { t, cue } of soundCues(reducedMotion)) {
    const at = startAt + t;
    if (at < c.currentTime - LATE_SECONDS) continue;
    const when = Math.max(at, c.currentTime);
    playHatchCue(c, out, cue, when);
    scheduled.push({ cue, at: when });
  }
  return {
    scheduled,
    cancel() {
      out.disconnect();
    },
  };
}

export function createHatchSound(): HatchSound {
  const Ctx = (globalThis as { AudioContext?: typeof AudioContext }).AudioContext;
  let ctx: AudioContext | null = null;
  let out: GainNode | null = null;
  let live = false;

  return {
    async start() {
      const began = globalThis.performance?.now() ?? Date.now();
      // Sound off in Settings (M19): no context at all, so every cue is a no-op.
      if (Ctx && soundEnabled()) {
        try {
          ctx = new Ctx();
          out = ctx.createGain();
          out.gain.value = HATCH_SOUND_LEVEL;
          out.connect(ctx.destination);
          if (ctx.state !== 'running') await Promise.race([ctx.resume(), new Promise((r) => setTimeout(r, 150))]);
          live = ctx.state === 'running';
        } catch {
          live = false;
        }
      }
      const elapsedMs = (globalThis.performance?.now() ?? Date.now()) - began;
      try {
        reporter?.({ sound: live, elapsedMs });
      } catch {
        // A reporter that throws never stops the hatch.
      }
      return live;
    },
    play(cue) {
      if (!soundEnabled() || !live || !ctx || !out) return;
      playHatchCue(ctx, out, cue, ctx.currentTime + 0.01);
    },
    dispose() {
      live = false;
      void ctx?.close().catch(() => {});
      ctx = null;
    },
  };
}
