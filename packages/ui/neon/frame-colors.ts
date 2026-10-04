import { brand } from '@acme/theme';
import { neonColor, type NeonColorInput } from './colors.ts';
import { shadeSteps } from './shade.ts';

/** Resolved colours for one CornerCutFrame, shared by the web and native forks. */
export function frameColors(tone: NeonColorInput, variant: 'solid' | 'outline') {
  const steps = shadeSteps(tone);
  const color = neonColor(tone);
  return variant === 'solid'
    ? { fill: steps.face, border: steps.shadow, depth: steps.deep, glow: color.glow }
    : { fill: brand.night, border: steps.face, depth: steps.deep, glow: color.glow };
}
