import { motion, motionTokens, type MotionEasing, type MotionTokenName } from '@acme/theme';

/** The four control points of a CSS `cubic-bezier(...)` easing token. Pure. */
export function bezierPoints(css: string): [number, number, number, number] {
  const m = /cubic-bezier\(([^)]+)\)/.exec(css);
  const nums = m ? m[1]!.split(',').map((n) => Number(n.trim())) : [];
  if (nums.length !== 4 || nums.some((n) => !Number.isFinite(n))) return [0.2, 0, 0, 1];
  return nums as [number, number, number, number];
}

/** Control points for a kit easing name (`standard`, `emphasized`, `exit`). */
export function easingPoints(name: MotionEasing): [number, number, number, number] {
  return bezierPoints(motion.easing[name]);
}

/** Duration of a motion token, full or reduced; 0 when the step has no duration (`instant`, `absent`). */
export function tokenMs(name: MotionTokenName, reduced: boolean): number {
  const step = reduced ? motionTokens[name].reduced : motionTokens[name].full;
  return step.kind === 'tween' ? step.durationMs : 0;
}
