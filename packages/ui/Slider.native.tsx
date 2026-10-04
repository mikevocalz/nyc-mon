'use client';
import { Host, Slider as ExpoSlider } from '@expo/ui';
import { tint } from '@expo/ui/swift-ui/modifiers';
import { View } from './tw';
import { Label } from './primitives';
import { NEON_FIELD } from './cards/neon-field';
import { TONE_CLASSES, resolveControlTone, toneHex } from './district';
import type { SliderProps } from './Slider.types';

/**
 * iOS (and any non-Android native target): the SwiftUI slider, tinted in the
 * tone. A slider keeps the OS control on native because the drag physics,
 * the VoiceOver adjustable actions and the haptic detents are behaviour a
 * hand-rolled track would have to reimplement (and the package carries no
 * gesture-handler dependency to build one on). The nameplate label stays in
 * the kit. Android has its own fork (Slider.android.tsx) for Compose colours.
 */
export function Slider({
  value, onValueChange, min = 0, max = 1, step, disabled, label, className, tone, district,
}: SliderProps) {
  const resolved = resolveControlTone(tone, district);
  const c = TONE_CLASSES[resolved];
  return (
    <View className={`gap-2 ${className ?? ''}`}>
      {label ? <Label className={`${NEON_FIELD.label} ${c.face} ${c.onFace}`}>{label}</Label> : null}
      <Host matchContents>
        <ExpoSlider
          value={value}
          onValueChange={onValueChange}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          // SwiftUI takes the colour as a modifier, not a class.
          modifiers={[tint(toneHex(resolved).face)]}
        />
      </Host>
    </View>
  );
}
