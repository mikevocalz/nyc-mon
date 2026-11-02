/**
 * The runtime half of an egg's `hatch.manifest.json` (written by
 * tooling/blender/hatching), parsed with zod, plus the pure timing math the
 * scene uses to seek the GLB's clips. No three.js here, so it runs under
 * `node --test`.
 */
import { z } from 'zod';

/** The hatch beats the `hatch` clip covers, in clip order. */
export const EGG_CLIP_PHASES = ['stir', 'pressure', 'crack', 'burst', 'emerge'] as const;
export type EggClipPhase = (typeof EGG_CLIP_PHASES)[number];

/** Every presentation phase (`HATCH_PRESENTATION_PHASES` in @acme/core). `attention` plays an attention clip over the finished hatch. */
export type EggHatchPhase = EggClipPhase | 'attention';

/** Which attention clip plays: the first-look outcome, or `lean-in` once a hesitation is resolved. */
export type EggAttention = 'lean-in' | 'hesitate';

const span = z
  .tuple([z.number().nonnegative(), z.number().nonnegative()])
  .refine(([a, b]) => b > a, { message: 'a phase must end after it starts' });

/** The fields the runtime reads. Unknown keys (fracture, gooProfile, source hashes) pass through untouched. */
export const eggHatchManifestSchema = z.object({
  runtimeVersion: z.literal(1),
  eggId: z.string().min(1),
  eggSpeciesId: z.string().min(1),
  hatchesIntoSpeciesId: z.string().min(1),
  baby: z.object({ proxy: z.boolean() }),
  runtime: z.object({
    glb: z.string().regex(/\.glb$/),
    clipMap: z.object({
      idle: z.string().min(1),
      hatch: z.string().min(1),
      leanIn: z.string().min(1),
      hesitate: z.string().min(1),
    }),
    phaseSeconds: z
      .object({ stir: span, pressure: span, crack: span, burst: span, emerge: span })
      .refine(
        (p) => EGG_CLIP_PHASES.every((phase, i) => i === 0 || p[phase][0] >= p[EGG_CLIP_PHASES[i - 1]!][1] - 1e-6),
        { message: 'phases must run in order without overlapping' },
      ),
    crackBeatSeconds: z.array(z.number().nonnegative()),
    shellPieceNames: z.array(z.string()).optional(),
  }),
});

export type EggHatchManifest = z.infer<typeof eggHatchManifestSchema>;
export type EggClipRole = keyof EggHatchManifest['runtime']['clipMap'];

/** An error the caller can show the static egg art for. `code` says which contract broke. */
export class EggHatchAssetError extends Error {
  readonly code: 'manifest' | 'fetch' | 'parse' | 'missing-clip' | 'egg-mismatch';
  constructor(code: EggHatchAssetError['code'], message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'EggHatchAssetError';
    this.code = code;
  }
}

/** Parses a manifest; throws `EggHatchAssetError('manifest')` with zod's issues on a bad file. */
export function parseEggHatchManifest(input: unknown): EggHatchManifest {
  const result = eggHatchManifestSchema.safeParse(input);
  if (!result.success) {
    throw new EggHatchAssetError('manifest', `hatch manifest is invalid: ${z.prettifyError(result.error)}`);
  }
  return result.data;
}

const clamp01 = (value: number) => (value <= 0 ? 0 : value >= 1 ? 1 : Number.isFinite(value) ? value : 0);

/**
 * Where the `hatch` clip sits at `progress` (0–1) through `phase`:
 * `phaseSeconds[phase][0] + progress × length`. Progress is clamped, so a
 * resumed phase seeks to its start and a finished one holds its end.
 */
export function hatchClipTime(manifest: EggHatchManifest, phase: EggClipPhase, progress: number): number {
  const [start, end] = manifest.runtime.phaseSeconds[phase];
  return start + clamp01(progress) * (end - start);
}

/** A phase's length in seconds, as the clip authors it. */
export function phaseLengthSeconds(manifest: EggHatchManifest, phase: EggClipPhase): number {
  const [start, end] = manifest.runtime.phaseSeconds[phase];
  return end - start;
}

/** Narrows a presentation phase to the beats the hatch clip covers. */
export function isClipPhase(phase: EggHatchPhase): phase is EggClipPhase {
  return phase !== 'attention';
}

/**
 * Progress through a phase that is playing in real time: `elapsed` seconds
 * since it started, over `durationSeconds` (the screen's phase length, which
 * may differ from the clip's). A zero or negative duration lands on the end.
 */
export function playbackProgress(elapsedSeconds: number, durationSeconds: number): number {
  if (!(durationSeconds > 0)) return 1;
  return clamp01(elapsedSeconds / durationSeconds);
}

/** The attention clip role for an outcome. */
export function attentionRole(attention: EggAttention): EggClipRole {
  switch (attention) {
    case 'lean-in':
      return 'leanIn';
    case 'hesitate':
      return 'hesitate';
  }
}

/** A clip as the loader returns it; only the name and length matter here. */
export interface NamedClip {
  readonly name: string;
  readonly duration: number;
}

/**
 * Maps each manifest role to the loaded clip of that exact name. Every role
 * is required: a GLB missing one throws `EggHatchAssetError('missing-clip')`
 * naming the absent clips, so the screen falls back to the static art
 * instead of faking a beat. Names are matched exactly, never guessed.
 */
export function resolveEggClips<C extends NamedClip>(manifest: EggHatchManifest, clips: readonly C[]): Record<EggClipRole, C> {
  const byName = new Map(clips.map((clip) => [clip.name, clip]));
  const roles = Object.keys(manifest.runtime.clipMap) as EggClipRole[];
  const missing = roles.filter((role) => !byName.has(manifest.runtime.clipMap[role]));
  if (missing.length > 0) {
    const names = missing.map((role) => `${role} → "${manifest.runtime.clipMap[role]}"`).join(', ');
    throw new EggHatchAssetError('missing-clip', `${manifest.eggId}: GLB has no clip for ${names}`);
  }
  const hatch = byName.get(manifest.runtime.clipMap.hatch)!;
  const emergeEnd = manifest.runtime.phaseSeconds.emerge[1];
  if (hatch.duration + 1e-3 < emergeEnd) {
    throw new EggHatchAssetError(
      'missing-clip',
      `${manifest.eggId}: "${hatch.name}" lasts ${hatch.duration.toFixed(3)} s, shorter than the ${emergeEnd} s the phases need`,
    );
  }
  return {
    idle: byName.get(manifest.runtime.clipMap.idle)!,
    hatch,
    leanIn: byName.get(manifest.runtime.clipMap.leanIn)!,
    hesitate: byName.get(manifest.runtime.clipMap.hesitate)!,
  };
}

/** What the rig shows, resolved from the caller's phase, progress and motion setting. */
export type EggPose =
  | { readonly kind: 'idle'; readonly loop: boolean }
  | { readonly kind: 'hatch'; readonly seconds: number }
  | { readonly kind: 'attention'; readonly attention: EggAttention; readonly progress: number };

/**
 * The pose for a phase at a progress. Reduced motion has no in-between: each
 * phase shows its end pose, and the idle egg holds still at the clip's rest
 * frame instead of looping its wobble.
 */
export function eggPoseFor(
  manifest: EggHatchManifest,
  phase: EggHatchPhase | null,
  progress: number,
  attention: EggAttention,
  reducedMotion: boolean,
): EggPose {
  if (phase === null) return reducedMotion ? { kind: 'hatch', seconds: 0 } : { kind: 'idle', loop: true };
  const p = reducedMotion ? 1 : clamp01(progress);
  if (isClipPhase(phase)) return { kind: 'hatch', seconds: hatchClipTime(manifest, phase, p) };
  return { kind: 'attention', attention, progress: p };
}
