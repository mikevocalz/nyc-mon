import { tv } from 'tailwind-variants';
import { Pressable, View } from './tw';
import { SlideUp } from './motion';
import { CONTROL_TONES, TONE_CLASSES, resolveControlTone, toneVariants, type ControlTone, type District } from './district';

// §9 tab-bar accessory: a slot that docks above the tab bar (mini player,
// tonight's rehearsal, download progress). Presentational: content comes in
// as children.
//
// NYC-MON: a night slab with a tone keyline along its top edge (`default`),
// or a solid tone face (`accent`). Kit Text does not inherit colour from its
// parent, so children colour themselves: `text-ink-50` / `text-silver-300` on
// the slab, `TONE_CLASSES[tone].onFace` on the accent face.
const accessory = tv({
  slots: {
    root:
      'w-full border-t-2 border-ink-800 transition-opacity duration-base motion-reduce:transition-none ' +
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset',
    keyline: 'h-1 w-full',
    body: 'w-full flex-row items-center gap-3 px-4 py-2.5',
  },
  variants: {
    tone: {
      default: { root: 'bg-ink-900' },
      accent: {},
    },
    color: toneVariants((c) => ({ keyline: c.face })),
  },
  // The accent body is the tone face.
  compoundVariants: CONTROL_TONES.map((color) => ({
    tone: 'accent' as const, color, class: { body: TONE_CLASSES[color].face },
  })),
  defaultVariants: { tone: 'default' },
});

export interface TabBarAccessoryProps {
  children: React.ReactNode;
  onPress?: () => void;
  /** default: night slab with a tone keyline. accent: solid tone face. */
  tone?: 'default' | 'accent';
  /** Colour family for the keyline / face. Overrides `district`. */
  color?: ControlTone;
  /** Theme by neighbourhood. Default midtown (orange). */
  district?: District;
  className?: string;
  'aria-label'?: string;
}

export function TabBarAccessory({ children, onPress, tone, color, district, className, ...a11y }: TabBarAccessoryProps) {
  const s = accessory({ tone, color: resolveControlTone(color, district) });
  const inner = (
    <>
      <View aria-hidden className={s.keyline()} />
      <View className={s.body()}>{children}</View>
    </>
  );
  if (onPress) {
    return (
      <SlideUp>
        <Pressable role="button" onPress={onPress} className={s.root({ className })} {...a11y}>
          {inner}
        </Pressable>
      </SlideUp>
    );
  }
  return (
    <SlideUp className={s.root({ className })} {...a11y}>
      {inner}
    </SlideUp>
  );
}
