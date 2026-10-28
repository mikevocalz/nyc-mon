import { monModelAssetForDex } from '@acme/assets/mons';
import type { AnimationIntent, MonMood } from '@acme/core/types';

/**
 * The loop each rigged form plays, by mood (first match wins in the Mon
 * rig). Only clips that exist in the GLBs (apps/web/public/mons/*.glb, listed
 * 2026-10-23). Neither file has a sleep or lie-down clip, so an asleep
 * Squeaklet holds its bind pose (an empty list) and an asleep Lil' Ratti
 * plays `emote_tired`. A mood with no entry plays the form's idle. The Alexa
 * views (packages/mcp-server, MonView) read this same table.
 */
export const MON_CLIPS: Readonly<Record<number, { readonly idle: readonly string[]; readonly byMood: Partial<Record<MonMood, readonly string[]>> }>> = {
  // Metro Egg: the hatch rig on its idle wobble. An egg has no mood. Its
  // `hatch` clip (6.5 s: stir, pressure, crack, burst, emerge) plays in
  // the hatch sequence, never as a loop here.
  1: { idle: ['egg_idle'], byMood: {} },
  // Squeaklet: jaw_chomp, mouth_close, rat_run, tail_swish, blink.
  2: {
    idle: ['tail_swish', 'rat_run'],
    byMood: {
      asleep: [],
      'needs-fullness': ['jaw_chomp', 'tail_swish'],
      'needs-social': ['rat_run', 'tail_swish'],
    },
  },
  // Lil' Ratti: full-body emotes and up/quad locomotion.
  3: {
    idle: ['up_idle', 'up_breathe', 'quad_idle_sniff'],
    byMood: {
      asleep: ['emote_tired', 'up_breathe'],
      sluggish: ['up_breathe', 'up_idle'],
      'needs-energy': ['emote_tired', 'up_breathe'],
      'needs-fullness': ['quad_idle_sniff', 'up_idle'],
      'needs-social': ['beckon', 'emote_curious', 'up_idle'],
    },
  },
};

/** The clip list for a rigged form in this mood (asleep wins over `mood`), or null when the form has no model. */
export function clipsFor(dexId: number | null, mood: MonMood | null, asleep: boolean): readonly string[] | null {
  const entry = dexId === null ? undefined : MON_CLIPS[dexId];
  if (!entry) return null;
  const key: MonMood | null = asleep ? 'asleep' : mood;
  return (key === null ? undefined : entry.byMood[key]) ?? entry.idle;
}

/** The one-shot reactions Home plays (ANIMATION_INTENTS in @acme/core): a tap and a return. */
export type MonReactionIntent = Extract<AnimationIntent, 'attention' | 'approach'>;

/**
 * Each intent's clips per rigged form, best first; the rig plays the first
 * its GLB has. Neither GLB has a clip named `attention` or `approach`
 * (clip lists read from apps/web/public/mons/*.glb, 2026-10-28), so these
 * map the intents onto clips that exist:
 * - Lil' Ratti: attention = `up_look_listen` (looks at the Caller), else
 *   `emote_curious`; approach = `wave` (a greeting), else `emote_happy`.
 * - Squeaklet has five clips (jaw_chomp, mouth_close, rat_run, tail_swish,
 *   blink) and none reads as a look or a greeting, so it has no entry and
 *   Home falls back to the glass's nudge for both.
 * The Metro Egg's `attention_lean_in` / `attention_hesitate` belong to M12's
 * first look, not to a Baby on Home.
 */
export const MON_REACTIONS: Readonly<Record<number, Partial<Record<MonReactionIntent, readonly string[]>>>> = {
  3: {
    attention: ['up_look_listen', 'emote_curious'],
    approach: ['wave', 'emote_happy'],
  },
};

/** The clips for a reaction on this form, or null when it has none (Home then nudges the Baby instead). */
export function reactionClipsFor(dexId: number | null, intent: MonReactionIntent): readonly string[] | null {
  if (dexId === null) return null;
  const clips = MON_REACTIONS[dexId]?.[intent];
  return clips === undefined || clips.length === 0 ? null : clips;
}

/**
 * How each rigged form's mouth rests, as rotations about the jaw's local X
 * from bind (radians; opening is negative on both rigs). Squeaklet binds with
 * the mouth ajar and its mouth_close clip shuts it at +0.357; Lil' Ratti
 * binds shut, and its neutral geometry has the mouth open, so its resting
 * face is mouthClose 1. The Alexa view (MonView) reads the same values.
 */
export const MON_MOUTHS: Readonly<Record<number, {
  readonly jawBone: string;
  readonly jawClosedRad: number;
  readonly jawOpenRad: number;
  readonly rest: Readonly<Record<string, number>>;
}>> = {
  2: { jawBone: 'jaw', jawClosedRad: 0.357, jawOpenRad: -0.15, rest: { mouthClose: 1 } },
  3: { jawBone: 'jaw', jawClosedRad: 0, jawOpenRad: -0.3, rest: { mouthClose: 1 } },
};

/** A Baby's model for the 3D stages: the bundled GLB, the clip list for its mood, and its mouth's rest pose. */
export interface MonModelSource {
  readonly kind: 'mon';
  readonly key: string;
  readonly glb: string | number;
  readonly clips: readonly string[];
  readonly mouth?: (typeof MON_MOUTHS)[number];
}

/** The rigged model for a form in this mood, or null when the form has no model yet (the stage shows Coming Soon). */
export function monModelSource(dexId: number | null, mood: MonMood | null = null, asleep = false): MonModelSource | null {
  const asset = monModelAssetForDex(dexId);
  const clips = clipsFor(dexId, mood, asleep);
  if (asset === undefined || clips === null || dexId === null) return null;
  const mouth = MON_MOUTHS[dexId];
  return { kind: 'mon', key: asset.key, glb: asset.glb, clips, ...(mouth ? { mouth } : {}) };
}
