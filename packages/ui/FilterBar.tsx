'use client';
import { tv } from 'tailwind-variants';
import { Pressable, Text, View } from './tw';
import { X, Plus } from './icons';
import type { ControlTone, District } from './district';
import { TONE_CLASSES, resolveControlTone } from './district';
import type { ReactNode } from 'react';

/**
 * The console's filter row (04-components.md G4): removable chips that wrap
 * onto new lines and never scroll sideways, plus "Add filter" and "Clear all"
 * affordances the screen wires to its Menu / store.
 */
const filter = tv({
  slots: {
    bar: 'w-full flex-row flex-wrap items-center gap-2',
    chip:
      'min-h-11 flex-row items-center gap-2 border-2 px-3 py-1.5 transition-colors duration-fast ' +
      'motion-reduce:transition-none',
    chipText: 'text-sm',
    chipRemove: 'h-6 w-6 items-center justify-center',
    action: 'min-h-11 flex-row items-center gap-1.5 px-2',
    actionText: 'font-display text-sm underline',
  },
  variants: {
    surface: {
      page: {
        chip: 'border-border bg-surface-raised',
        chipText: 'text-text',
        chipRemove: 'text-text-muted',
        actionText: 'text-text',
      },
      night: {
        chip: 'border-ink-700 bg-ink-900',
        chipText: 'text-silver-100',
        chipRemove: 'text-silver-400',
        actionText: 'text-silver-100',
      },
    },
  },
  defaultVariants: { surface: 'page' },
});

export interface FilterChipProps {
  /** The filter's name, e.g. "Consent status". */
  label: string;
  /** The applied value, e.g. "Pending" — the chip reads "Consent status: Pending". */
  value: string;
  onRemove: () => void;
  /** 'page' (default) follows the scheme; 'night' is the night facade. */
  surface?: 'page' | 'night';
  className?: string;
}

export function FilterChip({ label, value, onRemove, surface = 'page', className }: FilterChipProps) {
  const s = filter({ surface });
  return (
    <View className={s.chip({ className })}>
      <Text className={s.chipText()}>{`${label}: ${value}`}</Text>
      <Pressable role="button" aria-label={`Remove filter ${label}`} onPress={onRemove} className={s.chipRemove()}>
        <X size={14} />
      </Pressable>
    </View>
  );
}

export interface FilterBarProps {
  children?: ReactNode;
  /** Renders the "Add filter" affordance; the screen opens its Menu. */
  onAddFilter?: () => void;
  /** Renders "Clear all". */
  onClearAll?: () => void;
  /** 'page' (default) follows the scheme; 'night' is the night facade. */
  surface?: 'page' | 'night';
  /** Colour family of the "Add filter" accent. Overrides `district`. */
  tone?: ControlTone;
  /** Theme by neighbourhood. Default midtown (orange). */
  district?: District;
  className?: string;
}

export function FilterBar({ children, onAddFilter, onClearAll, surface = 'page', tone: toneProp, district, className }: FilterBarProps) {
  const s = filter({ surface });
  const t = TONE_CLASSES[resolveControlTone(toneProp, district)];
  return (
    <View className={s.bar({ className })}>
      {children}
      {onAddFilter ? (
        <Pressable role="button" aria-label="Add filter" onPress={onAddFilter} className={s.action()}>
          <Plus size={16} className={surface === 'page' ? t.pageText : t.text} />
          <Text className={s.actionText()}>Add filter</Text>
        </Pressable>
      ) : null}
      {onClearAll ? (
        <Pressable role="button" aria-label="Clear all filters" onPress={onClearAll} className={s.action()}>
          <Text className={s.actionText()}>Clear all</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
