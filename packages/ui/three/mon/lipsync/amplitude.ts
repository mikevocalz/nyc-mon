import type { MouthShape } from './visemes.ts';

/**
 * The audio-analysis mouth: a loudness envelope taken from the decoded clip,
 * the last fallback before a closed mouth. Computed once per clip by the host
 * (which has the audio) and sent whole, so the view needs no audio access.
 */
export interface AmplitudeTrack {
  readonly fps: number;
  /** 0..1 openness, one value per `1 / fps` seconds. */
  readonly values: readonly number[];
}

/** Below this share of the clip's loud level the mouth stays shut (breath, room tone). */
const GATE = 0.12;

/**
 * RMS per `1 / fps` window, normalised to the clip's 95th-percentile window
 * so a quiet voice still moves the mouth, gated, and square-rooted so soft
 * syllables still part the lips.
 */
export function amplitudeEnvelope(samples: Float32Array, sampleRate: number, fps = 60): AmplitudeTrack {
  const win = Math.max(1, Math.round(sampleRate / fps));
  const rms: number[] = [];
  for (let at = 0; at < samples.length; at += win) {
    let sum = 0;
    const end = Math.min(samples.length, at + win);
    for (let i = at; i < end; i++) {
      const s = samples[i] ?? 0;
      sum += s * s;
    }
    rms.push(Math.sqrt(sum / Math.max(1, end - at)));
  }
  const sorted = [...rms].sort((a, b) => a - b);
  const loud = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
  if (!(loud > 1e-4)) return { fps, values: rms.map(() => 0) };
  const values = rms.map((r) => {
    const x = Math.min(1, r / loud);
    return x < GATE ? 0 : Math.round(Math.sqrt((x - GATE) / (1 - GATE)) * 1000) / 1000;
  });
  return { fps, values };
}

/** The mouth at `tMs`, linear between envelope values: open with a little width, never round. */
export function sampleAmplitude(track: AmplitudeTrack, tMs: number, amplitude = 1): MouthShape {
  const f = (tMs / 1000) * track.fps;
  if (!(f >= 0) || f > track.values.length - 1) return { open: 0, wide: 0, round: 0, upper: 0 };
  const i = Math.floor(f);
  const a = track.values[i] ?? 0;
  const b = track.values[i + 1] ?? a;
  const v = (a + (b - a) * (f - i)) * amplitude;
  return { open: v * 0.75, wide: v * 0.3, round: 0, upper: 0 };
}
