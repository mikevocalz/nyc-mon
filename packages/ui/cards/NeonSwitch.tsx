'use client';
import Animated from 'react-native-reanimated';
import { tv } from 'tailwind-variants';
import { haptics } from '../haptics';
import { Pressable, View } from '../tw';
import { Text } from '../Text';
import { useReducedMotion } from '../backgrounds/use-reduced-motion';
import { resolveControlTone, toneVariants, type ControlTone, type District, type ToneClasses } from '../district';

const neonSwitch = tv({
  slots: {
    root: 'w-full flex-row items-center justify-between gap-3',
    label: 'min-w-0 flex-1 font-semibold',
    track:
      'relative h-8 w-14 shrink-0 justify-center border-2 transition-colors duration-base motion-reduce:transition-none ' +
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/50 focus-visible:ring-offset-2',
    thumb: 'h-6 w-6 border-2',
  },
  variants: {
    tone: toneVariants(() => ({})),
    value: {
      true: { thumb: 'border-ink-950 bg-ink-50' },
      false: { track: 'border-silver-600 bg-ink-900', thumb: 'border-silver-300 bg-silver-400' },
    },
    disabled: { true: { root: 'opacity-50' } },
  },
  compoundVariants: (Object.entries(toneVariants((c) => c)) as [ControlTone, ToneClasses][]).map(([tone, c]) => ({
    tone, value: true, class: { track: `${c.face} ${c.controlKeyline}` },
  })),
});

/** Thumb travel inside the 56px track: 2px inset each side, 24px thumb, 2px borders. */
const ON_X = 26;
const OFF_X = 2;

export interface NeonSwitchProps {
  value: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
  className?: string;
  tone?: ControlTone;
  district?: District;
}

/**
 * NeonBlade's neon toggle as a solid badge switch: the track fills with the
 * tone when on and the night thumb slides across. The slide is a Reanimated
 * 4 CSS transition on the thumb; reduced motion makes it instant. Shared by
 * the web and native Switch forks for `variant="neon"`.
 */
export function NeonSwitch({ value, onChange, label, disabled, className, tone, district }: NeonSwitchProps) {
  const reduced = useReducedMotion();
  const s = neonSwitch({ value, disabled, tone: resolveControlTone(tone, district) });
  return (
    <View className={s.root({ className })}>
      <Text className={s.label()}>{label}</Text>
      <Pressable
        role="switch"
        aria-checked={value}
        aria-label={label}
        aria-disabled={disabled}
        accessibilityState={{ checked: value, disabled: !!disabled }}
        disabled={disabled}
        onPress={() => {
          if (disabled) return;
          haptics.selection();
          onChange(!value);
        }}
        className={s.track()}
      >
        <Animated.View
          // Animated style: the thumb offset is a Reanimated CSS transition, which a class cannot drive.
          style={{
            transform: [{ translateX: value ? ON_X : OFF_X }],
            transitionProperty: 'transform',
            transitionDuration: reduced ? 0 : 180,
            transitionTimingFunction: 'ease-out',
          }}
        >
          <View className={s.thumb()} />
        </Animated.View>
      </Pressable>
    </View>
  );
}
