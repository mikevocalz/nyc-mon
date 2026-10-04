'use client';
import { useId, type KeyboardEvent } from 'react';
import { twMerge } from 'tailwind-merge';
import { Pressable, Text as RowText, View } from './tw';
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
 * Web Select: the neon well as a select-only combobox, opening the kit's
 * dropdown list (the same panel and rows as the NavBar menu) instead of the
 * browser's own popup, which cannot be styled. Focus stays on the well;
 * the highlighted row is announced through aria-activedescendant.
 *
 * Keys: ArrowDown/ArrowUp/Enter/Space open; in the list ArrowUp/ArrowDown
 * move, Home/End jump, a letter jumps to the next row starting with it,
 * Enter/Space pick, Escape closes, Tab picks nothing and moves on.
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
  const id = useId();
  const listId = `${id}-list`;
  const optionId = (i: number) => `${id}-opt-${i}`;

  const store = useInstanceStore(() => ({ open: false, active: -1, picked: value }));
  const open = useStore(store, (st) => st.open);
  const active = useStore(store, (st) => st.active);
  const picked = useStore(store, (st) => st.picked);
  const current = onValueChange ? value : picked;
  const selectedIndex = items.findIndex((o) => o.value === current);
  const selected = items[selectedIndex];

  const enabled = items.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0);
  const step = (from: number, dir: 1 | -1) => {
    if (!enabled.length) return -1;
    const pos = enabled.indexOf(from);
    if (pos < 0) return dir === 1 ? enabled[0]! : enabled[enabled.length - 1]!;
    return enabled[Math.min(enabled.length - 1, Math.max(0, pos + dir))]!;
  };

  const show = () => {
    if (disabled) return;
    store.setState({ open: true, active: selectedIndex >= 0 && !items[selectedIndex]?.disabled ? selectedIndex : step(-1, 1) });
  };
  const hide = () => store.setState({ open: false, active: -1 });
  const pick = (i: number) => {
    const o = items[i];
    if (!o || o.disabled) return;
    store.setState({ open: false, active: -1, picked: o.value });
    if (o.value !== current) onValueChange?.(o.value);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (disabled) return;
    const key = e.key;
    if (!open) {
      if (key === 'ArrowDown' || key === 'ArrowUp' || key === 'Enter' || key === ' ') {
        e.preventDefault();
        show();
      }
      return;
    }
    if (key === 'ArrowDown' || key === 'ArrowUp') {
      e.preventDefault();
      store.setState({ active: step(active, key === 'ArrowDown' ? 1 : -1) });
    } else if (key === 'Home' || key === 'End') {
      e.preventDefault();
      store.setState({ active: key === 'Home' ? step(-1, 1) : step(-1, -1) });
    } else if (key === 'Enter' || key === ' ') {
      e.preventDefault();
      pick(active);
    } else if (key === 'Escape') {
      e.preventDefault();
      hide();
    } else if (key === 'Tab') {
      hide();
    } else if (key.length === 1 && /\S/.test(key)) {
      const ch = key.toLowerCase();
      const order = [...enabled.filter((i) => i > active), ...enabled.filter((i) => i <= active)];
      const hit = order.find((i) => (items[i]!.label ?? items[i]!.value).toLowerCase().startsWith(ch));
      if (hit !== undefined) store.setState({ active: hit });
    }
  };

  // Web-only props the kit's press types don't list; the DOM button takes them as-is.
  const triggerExtras = {
    id: `${id}-trigger`,
    onBlur: hide,
    'aria-haspopup': 'listbox',
    'aria-expanded': open,
    'aria-controls': open ? listId : undefined,
    'aria-activedescendant': open && active >= 0 ? optionId(active) : undefined,
    'aria-invalid': error ? true : undefined,
  } as object;

  return (
    // RNW gives every View z-index 0, so later fields paint over the list unless
    // the open field lifts itself (the NavBar lifts its bar the same way).
    <View className={s.root({ className: twMerge(open ? 'relative z-50' : '', containerClassName) })}>
      <Label className={s.label()}>{label}</Label>
      <View className="relative w-full">
        <Pressable
          role="combobox"
          aria-label={ariaLabel ?? label}
          disabled={disabled}
          onPress={() => (open ? hide() : show())}
          onKeyDown={onKeyDown}
          className={s.select({ className: twMerge('flex-row items-center text-left', rounded ? 'rounded-soft' : '', className) })}
          {...triggerExtras}
        >
          <Text numberOfLines={1} className="text-base font-semibold text-ink-50">
            {selected ? (selected.label ?? selected.value) : ' '}
          </Text>
        </Pressable>
        <NeonChevron open={open} tone={toneName} disabled={disabled} className={s.chevron()} />
        {open ? (
          <View role={"listbox" as never} id={listId} aria-label={ariaLabel ?? label} className={twMerge(d.panel(), 'left-0 right-0')}>
            {items.map((o, i) => {
              const isSelected = i === selectedIndex;
              const optionExtras = {
                id: optionId(i),
                tabIndex: -1,
                'aria-selected': isSelected,
                // Keep focus on the well so its blur only fires when focus really leaves.
                onMouseDown: (e: { preventDefault: () => void }) => e.preventDefault(),
              } as object;
              return (
                <Pressable
                  key={`${o.value}-${i}`}
                  role="option"
                  aria-disabled={o.disabled || undefined}
                  onPress={() => pick(i)}
                  className={twMerge(
                    d.item(),
                    'w-full items-start',
                    i === active && !isSelected ? d.itemHighlight() : '',
                    isSelected ? d.itemActive() : '',
                    o.disabled ? d.itemDisabled() : '',
                  )}
                  {...optionExtras}
                >
                  <RowText className={twMerge(d.itemText(), isSelected ? d.itemActiveText() : '')}>{o.label ?? o.value}</RowText>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>
      {error ? (
        <Text role="alert" className={s.message()}>{error}</Text>
      ) : hint ? (
        <Text className={NEON_FIELD.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}
