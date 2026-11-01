'use client';
import { twMerge } from 'tailwind-merge';
import { Pressable, ScrollView, Text as RowText, View } from './tw';
import { Label } from './primitives';
import { Text } from './Text';
import { NeonChevron } from './neon/NeonChevron';
import { NEON_FIELD } from './cards/neon-field';
import { resolveControlTone } from './district';
import { dropdown } from './dropdown';
import { collectOptions, selectField } from './select-look';
import { useInstanceStore, useStore } from './use-instance-store';
import type { SelectProps } from './Select.types';

/**
 * Native Select: the same neon well, kit chevron and dropdown list as the web
 * fork (the NavBar panel and rows), instead of the OS picker menu, whose blue
 * system text and arrows ignore the theme. The list opens in flow under the
 * well, so it is never clipped by a parent and pushes the content below it
 * down; long lists scroll inside a capped panel. An option with an empty value
 * is the field's prompt: it shows muted in the well and is not listed.
 * A `value` with no `onValueChange` acts as the starting value.
 */
export function Select({
  label, hint, error, disabled, className, rounded = false, containerClassName, variant: _variant, tone, district,
  options, children, value, onValueChange, 'aria-label': ariaLabel,
}: SelectProps) {
  const toneName = resolveControlTone(tone, district);
  const s = selectField({ error: !!error, disabled, tone: toneName });
  const d = dropdown({ tone: toneName, rounded });
  const items = collectOptions(options, children);

  const store = useInstanceStore(() => ({ open: false, picked: value }));
  const open = useStore(store, (st) => st.open);
  const picked = useStore(store, (st) => st.picked);
  const current = onValueChange ? value : picked;
  const selected = items.find((o) => o.value === current);
  const prompt = items.find((o) => o.value === '');
  const shown = selected && selected.value !== '' ? selected : undefined;

  const pick = (next: string) => {
    store.setState({ open: false, picked: next });
    if (next !== current) onValueChange?.(next);
  };

  return (
    <View className={s.root({ className: containerClassName })}>
      <Label className={s.label()}>{label}</Label>
      <View className="relative w-full">
        <Pressable
          role="combobox"
          // The well's spoken name carries the current value or the prompt.
          aria-label={`${ariaLabel ?? label}, ${shown ? (shown.label ?? shown.value) : (prompt?.label ?? '')}`}
          aria-expanded={open}
          aria-disabled={disabled}
          accessibilityState={{ disabled: !!disabled }}
          disabled={disabled}
          onPress={() => store.setState({ open: !open })}
          className={s.select({ className: twMerge('flex-row items-center', rounded ? 'rounded-soft' : '', className) })}
        >
          <Text numberOfLines={1} className={shown ? 'text-base font-semibold text-ink-50' : 'text-base text-silver-400'}>
            {shown ? (shown.label ?? shown.value) : (prompt?.label ?? ' ')}
          </Text>
        </Pressable>
        <NeonChevron open={open} tone={toneName} disabled={disabled} className={s.chevron()} />
      </View>
      {open ? (
        // In flow, not absolute: the dropdown's top-full/z-50 placement is for web.
        <View role={'listbox' as never} aria-label={ariaLabel ?? label} className={twMerge(d.panel(), 'relative top-auto z-auto w-full')}>
          <ScrollView className="max-h-80" nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {items.filter((o) => o.value !== '').map((o, i) => {
              const isSelected = o.value === current;
              return (
                <Pressable
                  key={`${o.value}-${i}`}
                  role="option"
                  aria-selected={isSelected}
                  accessibilityState={{ selected: isSelected, disabled: !!o.disabled }}
                  disabled={o.disabled}
                  onPress={() => pick(o.value)}
                  className={twMerge(d.item(), 'w-full items-start', isSelected ? d.itemActive() : '', o.disabled ? d.itemDisabled() : '')}
                >
                  <RowText className={twMerge(d.itemText(), isSelected ? d.itemActiveText() : '')}>{o.label ?? o.value}</RowText>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}
      {error ? (
        <Text role="alert" className={s.message()}>{error}</Text>
      ) : hint ? (
        <Text className={NEON_FIELD.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}
