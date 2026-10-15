import { palette } from '@acme/theme';
import { resolveAccent, resolveControlTone, toneInput, type ControlTone, type District } from './district/index.ts';

/**
 * The NYC-MON look a Button or IconButton renders, resolved from the public
 * `variant` prop. Every name a caller can pass lands on one of three looks:
 * - solid: the corner-cut tone face over its depth plate (the default);
 * - outline: the corner-cut frame with a night face and a tone border;
 * - ghost: no frame, a tone label and a soft tone tint on hover.
 */
export type ControlLook = 'solid' | 'outline' | 'ghost';

/**
 * Every variant name Button accepts. `cornerCut` and `neon` are aliases of the
 * default. `cta` is the screen's one primary call to action: the brand orange
 * face in both schemes, labelled with the `on-cta` token (Decision #7).
 */
export type ButtonVariant = 'cornerCut' | 'neon' | 'primary' | 'accent' | 'outline' | 'ghost' | 'danger' | 'cta' | 'hlynk-care';
/** Every variant name IconButton accepts. */
export type IconButtonVariant = 'cornerCut' | 'neon' | 'primary' | 'outline' | 'ghost';

const LOOK: Record<ButtonVariant, ControlLook> = {
  cornerCut: 'solid',
  neon: 'solid',
  primary: 'solid',
  accent: 'solid',
  danger: 'solid',
  cta: 'solid',
  'hlynk-care': 'solid',
  outline: 'outline',
  ghost: 'ghost',
};

/**
 * Look and tone for a control. An explicit `tone` wins for every variant
 * except `danger`, which is always apple. `accent` takes the district's
 * second voice (royal for Midtown and Mega City, carolina Downtown, apple
 * Harlem) when no tone is given.
 */
export function controlLook(
  variant: ButtonVariant | undefined,
  tone?: ControlTone,
  district?: District,
): { look: ControlLook; tone: ControlTone } {
  const v = variant ?? 'cornerCut';
  if (v === 'danger') return { look: 'solid', tone: 'apple' };
  // The CTA face is brand orange whatever the tone or district: `cta` is orange-500 in both schemes.
  if (v === 'cta') return { look: 'solid', tone: 'orange' };
  if (v === 'accent' && !tone) {
    const accent = resolveAccent(district ?? 'midtown');
    return { look: 'solid', tone: accent === 'white' ? 'royal' : accent };
  }
  return { look: LOOK[v], tone: resolveControlTone(tone, district) };
}

/**
 * CornerCutFrame tone input for a look. Outline frames draw their border in
 * the face colour, and brick's face (orange 800) is too dark to hold 3:1 as a
 * control edge on night, so brick outlines use its control-border step (700),
 * the same one TONE_CLASSES.brick.controlBorder names.
 */
export function frameTone(look: ControlLook, tone: ControlTone): string {
  if (look === 'outline' && tone === 'brick') return palette.orange[700];
  return toneInput(tone);
}

/** The unavailable frame: a night face behind an ink keyline, no depth plate, no glow. */
export const DISABLED_FRAME_TONE: string = palette.ink[700];

/**
 * Class tokens from a caller's className that size the control within its
 * parent (flex-1, w-full, self-stretch...). On native the hit area is an outer
 * pressable around the visual surface, so these have to reach that outer layer
 * too or `className="flex-1"` grows the face inside a box that never grew.
 */
export function layoutClasses(className?: string): string {
  if (!className) return '';
  return className
    .split(/\s+/)
    .filter((c) => /^(flex-(1|auto|initial|none|\[.+\])|grow(-\d+)?|shrink(-\d+)?|basis-.+|w-.+|min-w-.+|max-w-.+|self-.+)$/.test(c))
    .join(' ');
}

/** The outer pressable's layout: the caller's layout classes, self-start unless they set their own self-*. */
export function outerLayout(className?: string): string {
  const own = layoutClasses(className);
  return /(^|\s)self-/.test(own) ? own : `self-start ${own}`.trim();
}
