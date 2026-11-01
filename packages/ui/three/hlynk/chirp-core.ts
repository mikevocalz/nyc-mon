/**
 * The H-Lynk side key's chirp (PS-037): a fast two-tone blip in the manner of
 * a Nextel Direct Connect chirp, synthesised, no asset. Same tones as the
 * Oct 4 version (9b6a262). The schedule is shared; the context comes from the
 * browser's Web Audio on web (side-key-chirp.ts) and from
 * react-native-audio-api on native (side-key-chirp.native.ts), which mirrors
 * the Web Audio API.
 */

interface Param {
  setValueAtTime(value: number, time: number): unknown;
  exponentialRampToValueAtTime(value: number, time: number): unknown;
}
interface Node {
  connect(destination: never): unknown;
}

/** The slice of a Web Audio context the chirp needs. Both platforms' contexts fit it. */
export interface ChirpContext {
  readonly currentTime: number;
  readonly destination: unknown;
  createGain(): Node & { gain: Param };
  createBiquadFilter(): Node & { type: string; frequency: Param };
  createOscillator(): Node & { type: string; frequency: Param; start(when?: number): unknown; stop(when?: number): unknown };
}

/** Schedules the chirp on `ctx`, starting now. */
export function scheduleChirp(ctx: ChirpContext): void {
  const t = ctx.currentTime;
  const connect = (from: Node, to: unknown) => from.connect(to as never);

  const out = ctx.createGain();
  out.gain.setValueAtTime(0.5, t);
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.setValueAtTime(3200, t);
  connect(lowpass, out);
  connect(out, ctx.destination);

  // ~60 ms on 1.45 kHz, a short gap, ~55 ms up on 1.83 kHz.
  for (const [freq, start, length] of [
    [1450, 0, 0.06],
    [1830, 0.075, 0.055],
  ] as const) {
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, t + start);
    const gate = ctx.createGain();
    gate.gain.setValueAtTime(0.0001, t + start);
    gate.gain.exponentialRampToValueAtTime(0.35, t + start + 0.006);
    gate.gain.exponentialRampToValueAtTime(0.0001, t + start + length);
    connect(osc, gate);
    connect(gate, lowpass);
    osc.start(t + start);
    osc.stop(t + start + length + 0.01);
  }
}
