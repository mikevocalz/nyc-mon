/**
 * Voice activity for barge-in on the NVIDIA companion (nvidia.tsx).
 *
 * Energy only: the RMS of each 20 ms mic frame (echo-cancelled,
 * noise-suppressed getUserMedia audio) against a threshold, with an attack
 * window before speech counts and a hold window before it ends. Hysteresis:
 * once speaking, the level only has to stay above `threshold * releaseRatio`.
 *
 * While the Mon's clip plays, the echo canceller should already remove it,
 * but a device without a working canceller would hear the Mon and cut itself
 * off. Two guards: the first `guardMs` of each clip are ignored (where a
 * canceller is still adapting), and the threshold rises to `playingThreshold`.
 */
export interface VadOptions {
  /** RMS (0..1) that starts speech when nothing plays. */
  readonly threshold?: number;
  /** RMS that starts speech while a Mon clip plays. */
  readonly playingThreshold?: number;
  /** How long the level must stay up before speech counts. */
  readonly attackMs?: number;
  /** How long it must stay down before speech ends. */
  readonly holdMs?: number;
  /** Ignore the first part of each clip. */
  readonly guardMs?: number;
  /** Once speaking, the level must fall below threshold * releaseRatio to count as quiet. */
  readonly releaseRatio?: number;
}

export interface VadFrame {
  readonly rms: number;
  /** performance.now() of the frame. */
  readonly at: number;
  /** When the clip playing now started (performance.now()), or null when nothing plays. */
  readonly playingSince: number | null;
}

export type VadEvent = 'speech-start' | 'speech-end';

export interface Vad {
  update(frame: VadFrame): VadEvent | null;
  readonly speaking: boolean;
  /** The first loud frame of the current (or last) speech. */
  readonly onsetAt: number | null;
  reset(): void;
}

export const VAD_DEFAULTS = {
  threshold: 0.02,
  playingThreshold: 0.05,
  attackMs: 60,
  holdMs: 600,
  guardMs: 250,
  releaseRatio: 0.6,
} as const;

export function createVad(options: VadOptions = {}): Vad {
  const o = { ...VAD_DEFAULTS, ...options };
  let speaking = false;
  let aboveSince: number | null = null;
  let lastLoud = 0;
  let onsetAt: number | null = null;
  return {
    update({ rms, at, playingSince }) {
      const playing = playingSince !== null;
      if (playing && at - playingSince < o.guardMs) {
        aboveSince = null;
        return null;
      }
      const threshold = playing ? o.playingThreshold : o.threshold;
      if (!speaking) {
        if (rms < threshold) {
          aboveSince = null;
          return null;
        }
        aboveSince ??= at;
        if (at - aboveSince < o.attackMs) return null;
        speaking = true;
        onsetAt = aboveSince;
        lastLoud = at;
        return 'speech-start';
      }
      if (rms >= threshold * o.releaseRatio) {
        lastLoud = at;
        return null;
      }
      if (at - lastLoud < o.holdMs) return null;
      speaking = false;
      aboveSince = null;
      return 'speech-end';
    },
    get speaking() {
      return speaking;
    },
    get onsetAt() {
      return onsetAt;
    },
    reset() {
      speaking = false;
      aboveSince = null;
      onsetAt = null;
    },
  };
}

/** RMS of 16-bit PCM on a 0..1 scale. */
export function pcmRms(pcm: Int16Array): number {
  if (pcm.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < pcm.length; i++) {
    const s = (pcm[i] ?? 0) / 32768;
    sum += s * s;
  }
  return Math.sqrt(sum / pcm.length);
}
