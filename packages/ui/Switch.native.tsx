'use client';

import { Host, Switch as ExpoSwitch } from '@expo/ui';
import { View } from './tw';
import { haptics } from './haptics';
import type { SwitchProps } from './Switch.types';
import { NeonSwitch } from './cards/NeonSwitch';

/**
 * Native toggle backed by the operating system: SwiftUI on iOS and
 * Jetpack Compose on Android. The public API stays identical on web.
 */
export function Switch({ value, onChange, label, disabled, className, variant, tone, district }: SwitchProps) {
  if (variant === 'neon') {
    return <NeonSwitch {...{ value, onChange, label, disabled, className, tone, district }} />;
  }
  return (
    <View className={`w-full ${className ?? ''}`}>
      <Host matchContents>
        <ExpoSwitch
          label={label}
          value={value}
          disabled={disabled}
          onValueChange={(next) => {
            if (disabled) return;
            haptics.selection();
            onChange(next);
          }}
        />
      </Host>
    </View>
  );
}
