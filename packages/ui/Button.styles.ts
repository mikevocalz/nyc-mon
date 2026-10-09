import { layout, typeRamp, xrTargets, xrTypeRamp } from '@acme/theme';
import { tv } from 'tailwind-variants';
import { TYPE_SCALE_TV } from './type-scale.ts';

/*
  Button styling, kept free of React Native so node tests can read it.

  Labels use the kit's type ramps, never `text-sm` / `text-base`: Uniwind's
  rem-14 polyfill renders those at 12.25 / 14 dp on native
  (docs/spatial/HORIZON-LAYOUT.md). Phones and the web get the mobile ramp
  (`text-type-*`, px); a Quest or PICO window gets the headset ramp
  (`text-xr-*`), read at arm's length.

  Every button's root carries `min-h-target` (48 px, emitted in px so the rem
  polyfill cannot shrink it). The root is the press target on both platforms,
  so the hit area meets Meta's 48 dp ray target on headsets, Material's 48 dp
  on Android and passes the 44 pt floor on iOS and the web (WCAG 2.5.8 asks
  for 24). Framed faces centre inside that root and keep their drawn size, so
  `sm` stays a small face with a full-size target.
*/
export const button = tv({
  slots: {
    root:
      'group min-h-target shrink-0 self-start rounded-none border-0 bg-transparent transition-transform duration-fast ' +
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bg ' +
      'motion-reduce:transition-none',
    label: 'whitespace-nowrap font-display tracking-wide',
    // Ghost hover: a tone tint layer, faded in by the root's group-hover.
    tint: 'pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-fast group-hover:opacity-100 motion-reduce:transition-none',
  },
  variants: {
    look: {
      // Frames stretch across the root, so className="flex-1" / fullWidth grow the face, not just the hit area.
      solid: { root: 'flex-col items-stretch justify-center active:translate-x-[3px] active:translate-y-[3px]' },
      outline: { root: 'flex-col items-stretch justify-center active:translate-x-[3px] active:translate-y-[3px]' },
      ghost: { root: 'relative flex-row items-center justify-center gap-2' },
    },
    size: { sm: {}, md: {}, lg: {} },
    /** Inside a headset window: the `text-xr-*` ramp. */
    xr: { false: {}, true: {} },
    /*
      Unavailable has to READ as unavailable. A dimmed tone face still looks
      like a button you can press, so a disabled control drops its tone, its
      depth plate (the press affordance) and its glow: a night face behind an
      ink keyline with a muted label, and no press sink.
    */
    disabled: {
      true: { root: 'cursor-not-allowed active:translate-x-0 active:translate-y-0', label: 'text-ink-400' },
    },
    // A full-width label wraps rather than clip at large text sizes (WCAG 1.4.4);
    // shrink lets it break inside the frame's flex row.
    fullWidth: { true: { root: 'w-full self-auto', label: 'min-w-0 shrink whitespace-normal text-center' } },
  },
  compoundVariants: [
    // Label steps: `type-label` is the mobile ramp's step for buttons; `lg` takes body.
    { xr: false, size: ['sm', 'md'], class: { label: 'text-type-label' } },
    { xr: false, size: 'lg', class: { label: 'text-type-body' } },
    { xr: true, size: ['sm', 'md'], class: { label: 'text-xr-label' } },
    { xr: true, size: 'lg', class: { label: 'text-xr-body' } },
    // Ghost pads its own root to the framed face's height (CUT_FACE padding plus
    // the 2px border), so a ghost and a solid button share a row's centre line.
    // `min-h-target` on the root keeps every ghost at a full target.
    { look: 'ghost', size: 'sm', class: { root: 'px-3 py-2.5' } },
    { look: 'ghost', size: 'md', class: { root: 'px-4 py-[14px] md:px-5 md:py-4' } },
    { look: 'ghost', size: 'lg', class: { root: 'px-5 py-[18px] md:px-6 md:py-[22px]' } },
  ],
  defaultVariants: { look: 'solid', size: 'md', xr: false, disabled: false },
}, TYPE_SCALE_TV);

export type ButtonSize = 'sm' | 'md' | 'lg';

// Corner-cut face padding and cut length per size; padding steps up at md.
export const CUT_FACE = {
  sm: { className: 'px-5 py-2.5', cut: 10 },
  md: { className: 'px-6 py-3 md:px-8 md:py-3.5', cut: 14 },
  lg: { className: 'px-8 py-4 md:px-10 md:py-5', cut: 18 },
} as const satisfies Record<ButtonSize, { className: string; cut: number }>;

/** Where a button is drawn, for its target floor. */
export type ButtonPlatform = 'ios' | 'android' | 'web' | 'headset';

/**
 * The smallest press target each platform accepts, in dp / pt / px:
 * Apple HIG 44 pt, Material 48 dp, WCAG 2.5.5 44 px on the web, Meta's
 * 48 dp for controller rays and hand pinch.
 */
export const TARGET_FLOOR: Readonly<Record<ButtonPlatform, number>> = {
  ios: layout.minTargetIosPt,
  android: layout.minTargetAndroidDp,
  web: layout.minTargetIosPt,
  headset: xrTargets.target,
};

/**
 * The min height, in dp, that a button's resolved root classes give its press
 * target. Only px-emitted spacing tokens count (`min-h-target` reads
 * `--spacing-target`, from `xrTargets.target`); a rem class such as
 * `min-h-11` scales with the root font size (38.5 dp under the rem-14
 * polyfill, 44 px on the web), so it is no floor. The platform does not
 * change the class: a headset or phone build resolves the same root.
 */
export function buttonMinHeight(
  look: 'solid' | 'outline' | 'ghost',
  size: ButtonSize,
  platform: ButtonPlatform,
): number {
  const root = button({ look, size, xr: platform === 'headset' }).root().split(' ');
  return root.includes('min-h-target') ? xrTargets.target : 0;
}

/** The label's ramp step for a size, so tests and stories can name it. */
export function buttonLabelStep(size: ButtonSize, headset: boolean): keyof typeof typeRamp | keyof typeof xrTypeRamp {
  if (headset) return size === 'lg' ? 'xr-body' : 'xr-label';
  return size === 'lg' ? 'type-body' : 'type-label';
}
