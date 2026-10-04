'use client';
import { tv } from 'tailwind-variants';
import { Input, Label } from './primitives';
import { View } from './tw';
import { NEON_FIELD } from './cards/neon-field';
import { TONE_CLASSES, resolveControlTone, toneHex } from './district';
import type { SliderProps } from './Slider.types';

// The NYC-MON slider on web: a real <input type="range"> (keyboard, screen
// reader values and pointer drag come from the browser), drawn as a night
// well with a heavy ink keyline, a solid tone fill and a white slab thumb
// keyed in night. The thumb glows in the tone only on keyboard focus.
// Track colours read two CSS custom properties set from props (--fill,
// --pct), so one class string serves every tone.
const slider = tv({
  slots: {
    root: 'gap-2',
    label: NEON_FIELD.label,
    input:
      'h-7 w-full cursor-pointer appearance-none bg-transparent focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ' +
      '[&::-webkit-slider-runnable-track]:h-3 [&::-webkit-slider-runnable-track]:border-2 [&::-webkit-slider-runnable-track]:border-ink-800 ' +
      '[&::-webkit-slider-runnable-track]:bg-[linear-gradient(to_right,var(--fill)_0_var(--pct),var(--color-ink-950)_var(--pct)_100%)] ' +
      '[&::-webkit-slider-thumb]:-mt-2 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none ' +
      '[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-ink-950 [&::-webkit-slider-thumb]:bg-ink-50 ' +
      '[&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:duration-fast motion-reduce:[&::-webkit-slider-thumb]:transition-none ' +
      'active:[&::-webkit-slider-thumb]:scale-110 focus-visible:[&::-webkit-slider-thumb]:shadow-[0_0_14px_0_var(--fill)] ' +
      '[&::-moz-range-track]:h-2 [&::-moz-range-track]:border-2 [&::-moz-range-track]:border-ink-800 [&::-moz-range-track]:bg-ink-950 ' +
      '[&::-moz-range-progress]:h-2 [&::-moz-range-progress]:bg-[var(--fill)] ' +
      '[&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-none [&::-moz-range-thumb]:border-2 ' +
      '[&::-moz-range-thumb]:border-ink-950 [&::-moz-range-thumb]:bg-ink-50 focus-visible:[&::-moz-range-thumb]:shadow-[0_0_14px_0_var(--fill)]',
  },
});

export function Slider({
  value, onValueChange, min = 0, max = 1, step, disabled, label, className, tone, district,
}: SliderProps) {
  const resolved = resolveControlTone(tone, district);
  const c = TONE_CLASSES[resolved];
  const s = slider();
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <View className={s.root({ className })}>
      {label ? <Label className={`${s.label()} ${c.face} ${c.onFace}`}>{label}</Label> : null}
      <Input
        {...({ type: 'range', min, max, step: step ?? 'any', disabled } as object)}
        aria-label={label ?? 'Value'}
        value={String(value)}
        onChangeText={(next: string) => onValueChange(Number.parseFloat(next))}
        className={s.input()}
        // Computed: the fill colour comes from the tone prop and the fill length from value/min/max.
        style={{ '--fill': toneHex(resolved).face, '--pct': `${pct}%` } as object}
      />
    </View>
  );
}
