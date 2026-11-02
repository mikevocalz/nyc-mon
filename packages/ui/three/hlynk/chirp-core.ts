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

/** A node that can feed another. Both platforms' AudioNodes fit it structurally. */
export interface CueNode {
  connect(destination: CueNode): unknown;
}

/**
 * The slice of a Web Audio context the chirp and the care cues need. The
 * browser's AudioContext and react-native-audio-api's AudioContext both
 * satisfy it as they are, so callers pass them without a cast.
 */
export interface ChirpContext {
  readonly currentTime: number;
  readonly destination: CueNode;
  createGain(): CueNode & { gain: Param };
  createBiquadFilter(): CueNode & { type: string; frequency: Param };
  createOscillator(): CueNode & { type: string; frequency: Param; start(when?: number): unknown; stop(when?: number): unknown };
}

/** The chirp's tones: [Hz, start s, length s]. ~60 ms on 1.45 kHz, a short gap, ~55 ms up on 1.83 kHz. */
const CHIRP_TONES = [
  [1450, 0, 0.06],
  [1830, 0.075, 0.055],
] as const;
/** The oscillator runs this long past its gate. */
const CHIRP_STOP_TAIL = 0.01;

/** How long the chirp sounds, stop tail included, in seconds. */
export function chirpSeconds(): number {
  return Math.max(...CHIRP_TONES.map(([, start, length]) => start + length)) + CHIRP_STOP_TAIL;
}

/** Schedules the chirp on `ctx`, starting now. */
export function scheduleChirp(ctx: ChirpContext): void {
  const t = ctx.currentTime;

  const out = ctx.createGain();
  out.gain.setValueAtTime(0.5, t);
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.setValueAtTime(3200, t);
  lowpass.connect(out);
  out.connect(ctx.destination);

  for (const [freq, start, length] of CHIRP_TONES) {
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, t + start);
    const gate = ctx.createGain();
    gate.gain.setValueAtTime(0.0001, t + start);
    gate.gain.exponentialRampToValueAtTime(0.35, t + start + 0.006);
    gate.gain.exponentialRampToValueAtTime(0.0001, t + start + length);
    osc.connect(gate);
    gate.connect(lowpass);
    osc.start(t + start);
    osc.stop(t + start + length + CHIRP_STOP_TAIL);
  }
}
