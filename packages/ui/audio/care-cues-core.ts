import type { ChirpContext } from '../three/hlynk/chirp-core.ts';

/**
 * Mon Space care cues: short chiptune stingers, synthesised, no asset. They
 * run through the same Web Audio graph as the H-Lynk side-key chirp
 * (chirp-core.ts): square (and one triangle) oscillators, each behind a
 * 6 ms attack gate, into a 3.2 kHz lowpass and a 0.5 output gain. A note at
 * full level peaks at the chirp's own 0.35, so a cue is never louder than the
 * chirp. The browser's Web Audio plays them on web (care-cues.ts) and
 * react-native-audio-api on native (care-cues.native.ts).
 *
 * A cue never carries state alone: the Mon Space screen pairs every one with
 * the LED, on-screen text and a haptic, and the cue is skipped entirely when
 * the Caller turns Sound off.
 */

export const CARE_CUES = ['hatch', 'evolve', 'attention', 'select', 'cancel', 'flush', 'dose'] as const;
export type CareCue = (typeof CARE_CUES)[number];

export interface CueNote {
  /** MIDI note number (69 = A4 = 440 Hz). */
  readonly midi: number;
  /** Seconds from the cue's start. */
  readonly start: number;
  /** Seconds the gate stays open. */
  readonly length: number;
  readonly wave: 'square' | 'triangle';
  /** 0..1 of CARE_CUE_NOTE_PEAK. Voices sounding together sum to 1 at most. */
  readonly level: number;
  /** MIDI note the pitch slides to by the end of the note (exponential). */
  readonly glideTo?: number;
}

/** A full-level note's gate peak: the side-key chirp's own 0.35. */
export const CARE_CUE_NOTE_PEAK = 0.35;
/** The output gain and lowpass the chirp uses. */
const OUTPUT_GAIN = 0.5;
const LOWPASS_HZ = 3200;
const ATTACK = 0.006;
/** The oscillator runs this long past its gate so the release reaches silence. */
const STOP_TAIL = 0.01;
/** No cue runs longer than this. */
export const CARE_CUE_MAX_SECONDS = 1.5;

const sq = (midi: number, start: number, length: number, level = 0.8): CueNote => ({ midi, start, length, wave: 'square', level });

/** Rising arpeggio C-E-G-C, stepped up a tone twice, for the evolution. */
function evolveNotes(): CueNote[] {
  const groups = [
    [72, 76, 79, 84],
    [74, 78, 81, 86],
    [76, 80, 83, 88],
  ];
  const notes = groups.flat().map((midi, i) => sq(midi, i * 0.055, 0.05, 0.75));
  notes.push(sq(100, 0.68, 0.4, 0.8)); // E7, held
  return notes;
}

/** The note tables. Pure data; every number is game feel. */
export const CARE_CUE_NOTES: Readonly<Record<CareCue, readonly CueNote[]>> = {
  // C5 E5 G5 C6, a G5 pickup, then C6 held: the egg opens.
  hatch: [sq(72, 0, 0.08), sq(76, 0.09, 0.08), sq(79, 0.18, 0.08), sq(84, 0.27, 0.08), sq(79, 0.38, 0.08), sq(84, 0.48, 0.4)],
  evolve: evolveNotes(),
  // Three A6/E6 beep pairs, once per call opening. Never loops.
  attention: [0, 0.28, 0.56].flatMap((t) => [sq(93, t, 0.08, 0.7), sq(88, t + 0.1, 0.08, 0.7)]),
  // One A6 tick.
  select: [sq(93, 0, 0.04, 0.6)],
  // E6 then A5: a falling tick.
  cancel: [sq(88, 0, 0.035, 0.6), sq(81, 0.045, 0.05, 0.6)],
  // A falling swirl over a triangle undertow, then a small plip as the bowl clears.
  flush: [
    { midi: 84, start: 0, length: 0.45, wave: 'square', level: 0.6, glideTo: 48 },
    { midi: 72, start: 0.05, length: 0.4, wave: 'triangle', level: 0.4, glideTo: 40 },
    sq(91, 0.5, 0.04, 0.6),
  ],
  // Two rising blips and a soft low gulp.
  dose: [sq(79, 0, 0.05, 0.7), sq(86, 0.07, 0.06, 0.7), { midi: 67, start: 0.16, length: 0.14, wave: 'triangle', level: 0.7 }],
};

export function midiHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

/** How long a cue sounds, release tail included, in seconds. */
export function cueSeconds(cue: CareCue): number {
  return Math.max(...CARE_CUE_NOTES[cue].map((n) => n.start + n.length)) + STOP_TAIL;
}

/** Schedules `cue` on `ctx`, starting now. Returns its length in seconds. */
export function scheduleCareCue(ctx: ChirpContext, cue: CareCue): number {
  const t = ctx.currentTime;
  const connect = (from: { connect(d: never): unknown }, to: unknown) => from.connect(to as never);

  const out = ctx.createGain();
  out.gain.setValueAtTime(OUTPUT_GAIN, t);
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.setValueAtTime(LOWPASS_HZ, t);
  connect(lowpass, out);
  connect(out, ctx.destination);

  for (const n of CARE_CUE_NOTES[cue]) {
    const on = t + n.start;
    const off = on + n.length;
    const osc = ctx.createOscillator();
    osc.type = n.wave;
    osc.frequency.setValueAtTime(midiHz(n.midi), on);
    if (n.glideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(midiHz(n.glideTo), off);
    const gate = ctx.createGain();
    gate.gain.setValueAtTime(0.0001, on);
    gate.gain.exponentialRampToValueAtTime(CARE_CUE_NOTE_PEAK * n.level, on + ATTACK);
    gate.gain.exponentialRampToValueAtTime(0.0001, off);
    connect(osc, gate);
    connect(gate, lowpass);
    osc.start(on);
    osc.stop(off + STOP_TAIL);
  }
  return cueSeconds(cue);
}

export interface CareCuePorts {
  /** The Caller's Sound switch, read at the moment a cue would play. */
  enabled(): boolean;
  /** The platform's audio context, created lazily; null where there is no audio. */
  context(): ChirpContext | null;
  /** Called with the cue's length just before it is scheduled (native holds the iOS session for it). */
  willPlay?(seconds: number): void;
}

/** Builds `playCareCue` for one platform. Sound off returns before any context or session work. */
export function createCareCuePlayer(ports: CareCuePorts): (cue: CareCue) => void {
  return (cue) => {
    if (!ports.enabled()) return;
    if (!Object.hasOwn(CARE_CUE_NOTES, cue)) return;
    try {
      const ctx = ports.context();
      if (!ctx) return;
      ports.willPlay?.(cueSeconds(cue));
      scheduleCareCue(ctx, cue);
    } catch {
      // No audio here: the cue's LED, text and haptic still carry the moment.
    }
  };
}
