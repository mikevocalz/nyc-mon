/**
 * Rigged 3D Mons for the companion page, copied from the app's table
 * (packages/app/features/companion/mon-models.ts — clip names and mouth
 * rests read from apps/web/public/mons/*.glb) so web-sim stays free of app
 * code, the same split companionArt.ts keeps for the stills. The Alexa view
 * (packages/mcp-server, MonView) mirrors the same rows.
 *
 * The server hosts the GLBs at /mons/<file>.glb (server/main.ts; copies live
 * in packages/web-sim/public/mons). A form with no model gets no entry: the
 * panel keeps the still, never stubs one.
 */
import type { MonMood } from '@acme/core/types';
import type { MouthRig } from '@acme/ui/three/mon';

export interface CompanionModel {
  /** /mons/<file>.glb on this server. */
  readonly file: string;
  readonly idle: readonly string[];
  readonly byMood: Partial<Record<MonMood, readonly string[]>>;
  /** Jaw + resting morphs for lip-sync; absent on forms with no mouth rig. */
  readonly mouth?: MouthRig;
}

const MODELS: Readonly<Record<number, CompanionModel>> = {
  // Metro Egg: the hatch rig on its idle wobble. No mouth.
  1: { file: 'metro-egg', idle: ['egg_idle'], byMood: {} },
  // Squeaklet: jaw_chomp, mouth_close, rat_run, tail_swish, blink. No clip
  // reads as asleep, so an asleep Squeaklet holds its bind pose ([]).
  2: {
    file: 'squeaklet',
    idle: ['tail_swish', 'rat_run'],
    byMood: {
      asleep: [],
      'needs-fullness': ['jaw_chomp', 'tail_swish'],
      'needs-social': ['rat_run', 'tail_swish'],
    },
    mouth: { jawBone: 'jaw', jawClosedRad: 0.357, jawOpenRad: -0.15, rest: { mouthClose: 1 } },
  },
  // Lil' Ratti: full-body emotes and up/quad locomotion.
  3: {
    file: 'lil-ratti',
    idle: ['up_idle', 'up_breathe', 'quad_idle_sniff'],
    byMood: {
      asleep: ['emote_tired', 'up_breathe'],
      sluggish: ['up_breathe', 'up_idle'],
      'needs-energy': ['emote_tired', 'up_breathe'],
      'needs-fullness': ['quad_idle_sniff', 'up_idle'],
      'needs-social': ['beckon', 'emote_curious', 'up_idle'],
    },
    mouth: { jawBone: 'jaw', jawClosedRad: 0, jawOpenRad: -0.3, rest: { mouthClose: 1 } },
  },
};

/** The rigged model for a Dex number, or null when the form has none (the panel keeps the still). */
export function companionModelForDex(dexId: number | null): CompanionModel | null {
  return dexId === null ? null : MODELS[dexId] ?? null;
}

/** The clip list for this form in this mood (asleep wins over `mood`); first match wins in the rig. */
export function companionModelClips(model: CompanionModel, mood: string | null, asleep: boolean): readonly string[] {
  const key = asleep ? 'asleep' : mood;
  return (key === null ? undefined : model.byMood[key as MonMood]) ?? model.idle;
}
