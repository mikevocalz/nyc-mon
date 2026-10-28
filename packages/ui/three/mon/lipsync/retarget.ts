import type { MouthShape } from './visemes.ts';

/**
 * Retargeting: every lip-sync source ends up as values for the Mon rig's own
 * channels. `jaw` is the jaw bone's opening (0 closed, 1 the rig's open
 * angle); every other key is a morph target name as the GLB spells it.
 * MonModel3D writes only the channels a model has, so Squeaklet (jaw plus
 * `mouthClose`) and Lil' Ratti (19 morphs) share one table.
 *
 * Lil' Ratti's morphs (Mesh0, in file order): lidHalf_L, lid_L, lidHalf_R,
 * lid_R, mouthClose, mouthWide, mouthRound, mouthUpperUp, smile_L, frown_L,
 * browUp_L, browDown_L, cheekUp_L, smile_R, frown_R, browUp_R, browDown_R,
 * cheekUp_R, noseWrinkle. Squeaklet's (Mesh_0): lidHalf_L, lid_L, lidHalf_R,
 * lid_R, mouthClose. On both, `mouthClose` at 1 is the closed mouth.
 */
export type RigTargets = Readonly<Record<string, number>>;

/** Channels that speech owns outright while it plays; the clip's value is blended away. */
export const SPEECH_CHANNELS = ['jaw', 'mouthClose', 'mouthWide', 'mouthRound', 'mouthUpperUp'] as const;

/** Expression channels: merged with the clip by per-channel max, so an emote keeps its brows under speech. */
export const EXPRESSION_CHANNELS = [
  'smile_L',
  'smile_R',
  'frown_L',
  'frown_R',
  'browUp_L',
  'browUp_R',
  'browDown_L',
  'browDown_R',
  'cheekUp_L',
  'cheekUp_R',
  'noseWrinkle',
] as const;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/**
 * A viseme or amplitude mouth on the rig. Lips close fully only when the
 * mouth is nearly shut, so a small opening still parts them.
 */
export function mouthToRig(shape: MouthShape): RigTargets {
  return {
    jaw: clamp01(shape.open),
    mouthClose: clamp01(1 - shape.open * 1.4),
    mouthWide: clamp01(shape.wide),
    mouthRound: clamp01(shape.round),
    mouthUpperUp: clamp01(shape.upper),
  };
}

/** ARKit names come back from Audio2Face in PascalCase ("JawOpen"); compare in camelCase. */
export const arkitKey = (name: string): string => name.charAt(0).toLowerCase() + name.slice(1);

/**
 * Audio2Face-3D's ARKit-52 frame (named, already multiplied server-side) on
 * the Mon rig. Explicit, channel by channel:
 *  - jawOpen → jaw bone; it also widens the lips unless they are rounding.
 *  - mouthClose ← 1 - jawOpen. A2F's own MouthClose is not used: in the SDK it
 *    includes jaw opening, so it does not mean "lips shut" the way this rig's
 *    morph does.
 *  - mouthFunnel / mouthPucker → mouthRound; mouthStretch L/R → mouthWide;
 *    mouthUpperUp L/R → mouthUpperUp.
 *  - mouthSmile / mouthFrown / cheekSquint / browDown L/R → smile / frown /
 *    cheekUp / browDown _L/_R; browInnerUp with browOuterUp L/R → browUp _L/_R;
 *    noseSneer L/R → noseWrinkle.
 *  - eyeBlink is not mapped: blinking stays with the idle blink, as in
 *    MoyoLearn's ADR-112, so two drivers never fight over the lids.
 * Every channel is returned every frame, zeros included, so no weight sticks.
 */
export function arkitToRig(frame: Readonly<Record<string, number>>): RigTargets {
  const g = (name: string) => frame[name] ?? 0;
  const jaw = clamp01(g('jawOpen') * 1.6);
  const round = clamp01(Math.max(g('mouthFunnel'), g('mouthPucker')));
  const stretch = Math.max(g('mouthStretchLeft'), g('mouthStretchRight'));
  return {
    jaw,
    mouthClose: clamp01(1 - jaw * 1.4),
    mouthWide: clamp01(Math.max(stretch, jaw * 0.45 * (1 - round))),
    mouthRound: round,
    mouthUpperUp: clamp01((g('mouthUpperUpLeft') + g('mouthUpperUpRight')) / 2),
    smile_L: clamp01(g('mouthSmileLeft')),
    smile_R: clamp01(g('mouthSmileRight')),
    frown_L: clamp01(g('mouthFrownLeft')),
    frown_R: clamp01(g('mouthFrownRight')),
    browUp_L: clamp01(Math.max(g('browInnerUp'), g('browOuterUpLeft'))),
    browUp_R: clamp01(Math.max(g('browInnerUp'), g('browOuterUpRight'))),
    browDown_L: clamp01(g('browDownLeft')),
    browDown_R: clamp01(g('browDownRight')),
    cheekUp_L: clamp01(g('cheekSquintLeft')),
    cheekUp_R: clamp01(g('cheekSquintRight')),
    noseWrinkle: clamp01(Math.max(g('noseSneerLeft'), g('noseSneerRight'))),
  };
}

/** The ARKit names {@link arkitToRig} reads; the server ships only these columns. */
export const ARKIT_INPUTS: readonly string[] = [
  'jawOpen',
  'mouthFunnel',
  'mouthPucker',
  'mouthStretchLeft',
  'mouthStretchRight',
  'mouthUpperUpLeft',
  'mouthUpperUpRight',
  'mouthSmileLeft',
  'mouthSmileRight',
  'mouthFrownLeft',
  'mouthFrownRight',
  'browInnerUp',
  'browOuterUpLeft',
  'browOuterUpRight',
  'browDownLeft',
  'browDownRight',
  'cheekSquintLeft',
  'cheekSquintRight',
  'noseSneerLeft',
  'noseSneerRight',
];
