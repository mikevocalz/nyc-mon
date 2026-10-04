'use client';
import { tv } from 'tailwind-variants';
import { Pressable, View } from './tw';
import { Text } from './Text';
import { ChevronRight } from './icons';
import { NIGHT_SCHEME } from './NightScope';
import { TONE_CLASSES, resolveControlTone } from './district';
import { ROW_BAR } from './surface-look';
import type { CollapsibleProps } from './Collapsible.types';

/**
 * Web disclosure in the NYC-MON look: a night row with a heavy keyline and a
 * label in the display face. Open, the row takes a tone accent bar on its
 * left edge and the chevron turns to the tone; the content hangs under it
 * on a tone rule, like floors under a cornice.
 */
const collapsible = tv({
  slots: {
    root: 'gap-2',
    row:
      'min-h-11 flex-row items-center gap-2 border-2 border-l-[6px] border-ink-800 bg-ink-900 px-3 py-2 ' +
      'transition-colors duration-fast hover:bg-ink-800 motion-reduce:transition-none',
    chevron: 'transition-transform duration-fast motion-reduce:transition-none',
    label: 'flex-1 font-display text-base text-ink-50',
    body: 'ml-1.5 gap-2 border-l-2 py-1 pl-5',
  },
  variants: {
    open: {
      true: { chevron: 'rotate-90' },
      false: { row: 'border-l-ink-700', chevron: 'text-silver-300' },
    },
  },
});

export function Collapsible({ label, isOpen, onOpenChange, children, className, district, tone }: CollapsibleProps) {
  const toneName = resolveControlTone(tone, district);
  const t = TONE_CLASSES[toneName];
  const s = collapsible({ open: isOpen });
  return (
    <View className={s.root({ className })}>
      <Pressable
        role="button"
        aria-expanded={isOpen}
        onPress={() => onOpenChange(!isOpen)}
        className={s.row({ className: `${NIGHT_SCHEME} ${isOpen ? ROW_BAR[toneName].bar : ''} ${t.focusBorder}` })}
      >
        <ChevronRight size={18} className={s.chevron({ className: isOpen ? t.text : '' })} />
        <Text className={s.label()}>{label}</Text>
      </Pressable>
      {isOpen ? <View className={s.body({ className: t.border })}>{children}</View> : null}
    </View>
  );
}
