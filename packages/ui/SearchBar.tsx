'use client';
import { useEffect } from 'react';
import { tv } from 'tailwind-variants';
import { useDebouncedCallback } from '@tanstack/react-pacer';
import { useInstanceStore, useStore } from './use-instance-store';
import { View, Pressable } from './tw';
import { X } from './icons';
import { Input } from './primitives';
import { NEON_FIELD } from './cards/neon-field';
import { TONE_CLASSES, resolveControlTone, toneVariants, type ControlTone, type District } from './district';

// The NYC-MON search field: a solid tone tile carrying the magnifier, butted
// against a night well with a heavy tone border (the same well as
// NEON_FIELD). Focus lightens the border and adds the tone's accent glow.
const searchBar = tv({
  slots: {
    root: 'flex-row items-stretch',
    tile: 'w-11 shrink-0 items-center justify-center border-2 md:w-12',
    // The magnifier, drawn as two solid pieces: a ring and a 45-degree handle.
    ring: 'h-3.5 w-3.5 rounded-full border-2',
    handle: 'absolute bottom-[-3px] right-[-2px] h-2 w-[3px] -rotate-45',
    well: 'relative min-w-0 flex-1 justify-center',
    input: `${NEON_FIELD.input} -ml-[2px] pr-11`,
    clear:
      'absolute right-1.5 top-1/2 h-8 w-8 -translate-y-1/2 items-center justify-center transition-colors duration-fast ' +
      'hover:bg-ink-800 active:bg-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/60 ' +
      'motion-reduce:transition-none',
  },
  variants: {
    tone: toneVariants((c) => ({
      tile: `${c.face} ${c.controlKeyline}`,
      input: `${c.controlBorder} ${c.focusBorder} ${c.focusGlow}`,
    })),
    // Glyph colour follows the label colour on that face (TONE_CLASSES.onFace).
    darkGlyph: {
      true: { ring: 'border-ink-950', handle: 'bg-ink-950' },
      false: { ring: 'border-white', handle: 'bg-white' },
    },
  },
});

export interface SearchBarProps {
  /** Opt-in rounded corners (rounded-soft). Default false: square. */
  rounded?: boolean;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onSubmit?: () => void;
  /**
   * Debounce upstream onChangeText by this many ms (@tanstack/react-pacer).
   * The field itself always echoes keystrokes instantly.
   */
  debounceMs?: number;
  'aria-label'?: string;
  className?: string;
  /** Focus callbacks — consumers gate competing gestures on these. */
  onFocus?: () => void;
  onBlur?: () => void;
  /** Colour family for the tile and well border. Overrides `district`. */
  tone?: ControlTone;
  /** Theme by neighbourhood. Default Midtown (orange). */
  district?: District;
}

export function SearchBar({
  rounded = false, value, onChangeText, placeholder, onSubmit, debounceMs, className, onFocus, onBlur, tone, district,
  'aria-label': ariaLabel = 'Search',
}: SearchBarProps) {
  const resolved = resolveControlTone(tone, district);
  const s = searchBar({ tone: resolved, darkGlyph: TONE_CLASSES[resolved].onFace === 'text-ink-950' });

  // Instant local echo (zustand — repo rule) with debounced upstream delivery.
  const echo = useInstanceStore<{ text: string; external: string }>(() => ({
    text: value,
    external: value,
  }));
  const text = useStore(echo, (st) => st.text);
  // Adopt external value changes (e.g. parent cleared the query).
  useEffect(() => {
    if (debounceMs && value !== echo.getState().external) {
      echo.setState({ text: value, external: value });
    }
  }, [value, debounceMs, echo]);

  const debounced = useDebouncedCallback(
    (next: string) => onChangeText(next),
    { wait: debounceMs ?? 0, enabled: !!debounceMs },
  );

  const shownValue = debounceMs ? text : value;
  const handleChange = (next: string) => {
    if (debounceMs) {
      echo.setState({ text: next });
      debounced(next);
    } else {
      onChangeText(next);
    }
  };
  const clear = () => {
    if (debounceMs) echo.setState({ text: '', external: '' });
    onChangeText('');
  };

  return (
    // RNW renders role="search" as a search landmark; RN's Role type lags behind, hence the cast.
    <View role={'search' as never} className={s.root({ className: `${rounded ? 'rounded-soft overflow-hidden' : ''} ${className ?? ''}` })}>
      <View aria-hidden className={s.tile()}>
        <View className="relative">
          <View className={s.ring()} />
          <View className={s.handle()} />
        </View>
      </View>
      <View className={s.well()}>
        <Input
          role="searchbox"
          aria-label={ariaLabel}
          value={shownValue}
          onChangeText={handleChange}
          placeholder={placeholder}
          onSubmitEditing={onSubmit}
          onFocus={onFocus}
          onBlur={onBlur}
          returnKeyType="search"
          className={s.input()}
        />
        {shownValue ? (
          <Pressable
            role="button"
            aria-label="Clear search"
            onPress={clear}
            className={s.clear()}
          >
            {/* A lucide X at a heavy stroke, matching the weight of every other icon in the kit. */}
            <X size={16} strokeWidth={2.75} className="text-silver-300" />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
