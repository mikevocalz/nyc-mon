'use client';
import { palette } from '@acme/theme';
import { Host, Slider as ComposeSlider } from '@expo/ui/jetpack-compose';
import { View } from './tw';
import { Label } from './primitives';
import { NEON_FIELD } from './cards/neon-field';
import { TONE_CLASSES, resolveControlTone, toneHex } from './district';
import type { SliderProps } from './Slider.types';

/**
 * Android, PICO and Quest: the Material 3 Compose slider in the tone (fill
 * and thumb in the tone face, the unfilled track in night ink). It stays the
 * OS control for the same reason as iOS: drag physics, TalkBack adjust
 * actions and step detents come with it.
 */
export function Slider({
  value, onValueChange, min = 0, max = 1, step, disabled, label, className, tone, district,
}: SliderProps) {
  const resolved = resolveControlTone(tone, district);
  const c = TONE_CLASSES[resolved];
  const face = toneHex(resolved).face;
  // Compose counts the stops between min and max; the kit API gives the increment.
  const steps = step && step > 0 ? Math.max(0, Math.round((max - min) / step) - 1) : undefined;
  return (
    <View className={`gap-2 ${className ?? ''}`}>
      {label ? <Label className={`${NEON_FIELD.label} ${c.face} ${c.onFace}`}>{label}</Label> : null}
      <Host matchContents>
        <ComposeSlider
          value={value}
          min={min}
          max={max}
          steps={steps}
          enabled={!disabled}
          onValueChange={(v) => onValueChange(step && step > 0 ? Math.round((v - min) / step) * step + min : v)}
          // Compose takes colours as props, not classes.
          colors={{
            thumbColor: face,
            activeTrackColor: face,
            inactiveTrackColor: palette.ink[800],
            activeTickColor: palette.ink[950],
            inactiveTickColor: palette.ink[500],
          }}
        />
      </Host>
    </View>
  );
}
