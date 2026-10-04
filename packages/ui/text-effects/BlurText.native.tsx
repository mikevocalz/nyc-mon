import Animated from 'react-native-reanimated';
import { neonColor } from '../neon/colors';
import { useReducedMotion } from '../backgrounds/use-reduced-motion';
import { Text as TWText, View } from '../tw';
import type { EffectTextProps } from './types';

const FOCUS_IN = {
  from: { opacity: 0, transform: [{ scale: 1.04 }] },
  to: { opacity: 1, transform: [{ scale: 1 }] },
};

/**
 * BlurText on native. React Native has no text blur on iOS, and a touch
 * screen has no hover to clear one, so native plays the focus-in once on
 * mount (a fade and settle, Reanimated CSS animation) and then stays sharp.
 * Reduced motion shows it sharp at once.
 */
export function BlurText({ children, className, accessibilityLabel, colors }: EffectTextProps) {
  const reduced = useReducedMotion();
  const color = neonColor(Array.isArray(colors) ? colors[0] ?? 'white' : colors ?? 'white').base;
  return (
    <View className="self-start" aria-label={accessibilityLabel}>
      <Animated.View style={reduced ? undefined : { animationName: FOCUS_IN, animationDuration: 600, animationTimingFunction: 'ease-out' }}>
        {/* Colour is a runtime prop. */}
        <TWText className={className} style={{ color }}>
          {children}
        </TWText>
      </Animated.View>
    </View>
  );
}
