import type { SoundCue } from './hatch-timeline.ts';

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
 * does not; `start` resolves false then and every cue is a no-op.
 */
export interface HatchSound {
  /** Resolves whether sound can play. */
  start(): Promise<boolean>;
  play(cue: SoundCue): void;
  dispose(): void;
}

const LEVEL = 0.18;

export function createHatchSound(): HatchSound {
  const Ctx = (globalThis as { AudioContext?: typeof AudioContext }).AudioContext;
  let ctx: AudioContext | null = null;
  let out: GainNode | null = null;
  let live = false;

  const noise = (c: AudioContext, seconds: number) => {
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
  };
  const envelope = (c: AudioContext, at: number, attack: number, hold: number, release: number, peak: number) => {
    const g = c.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(peak, at + attack);
    g.gain.setValueAtTime(peak, at + attack + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, at + attack + hold + release);
    return g;
  };

  return {
    async start() {
      if (!Ctx) return false;
      try {
        ctx = new Ctx();
        out = ctx.createGain();
        out.gain.value = LEVEL;
        out.connect(ctx.destination);
        if (ctx.state !== 'running') await Promise.race([ctx.resume(), new Promise((r) => setTimeout(r, 150))]);
        live = ctx.state === 'running';
      } catch {
        live = false;
      }
      return live;
    },
    play(cue) {
      if (!live || !ctx || !out) return;
      const c = ctx;
      const now = c.currentTime + 0.01;
      if (cue === 'crack' || cue === 'tick') {
        const src = noise(c, 0.12);
        const bp = c.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = cue === 'crack' ? 2600 : 3800;
        bp.Q.value = 2.5;
        src.connect(bp).connect(envelope(c, now, 0.002, 0.01, cue === 'crack' ? 0.09 : 0.05, cue === 'crack' ? 1 : 0.5)).connect(out);
        src.start(now);
      } else if (cue === 'shimmer') {
        [523.25, 659.25, 783.99].forEach((hz, i) => {
          const o = c.createOscillator();
          o.type = 'sine';
          o.frequency.setValueAtTime(hz, now);
          o.frequency.linearRampToValueAtTime(hz * 1.5, now + 0.83);
          o.connect(envelope(c, now + i * 0.05, 0.3, 0.3, 0.3, 0.12)).connect(out!);
          o.start(now + i * 0.05);
          o.stop(now + 1.2);
        });
      } else if (cue === 'whoosh') {
        const src = noise(c, 0.9);
        const lp = c.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(400, now);
        lp.frequency.exponentialRampToValueAtTime(5000, now + 0.35);
        src.connect(lp).connect(envelope(c, now, 0.3, 0.05, 0.5, 0.6)).connect(out);
        src.start(now);
      } else {
        [1046.5, 1318.5, 1568].forEach((hz, i) => {
          const at = now + i * 0.14;
          const o = c.createOscillator();
          o.type = 'triangle';
          o.frequency.value = hz;
          o.connect(envelope(c, at, 0.008, 0.04, i === 2 ? 1.1 : 0.45, 0.45)).connect(out!);
          o.start(at);
          o.stop(at + 1.4);
        });
      }
    },
    dispose() {
      live = false;
      void ctx?.close().catch(() => {});
      ctx = null;
    },
  };
}
