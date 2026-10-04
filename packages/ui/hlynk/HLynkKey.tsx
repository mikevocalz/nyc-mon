'use client';
import { Platform } from 'react-native';
import { Button } from '../html';
import { ChevronLeft, ChevronRight, Home, Menu } from '../icons';
import { haptics } from '../haptics';
import { useInstanceStore, useStore } from '../use-instance-store';
import { View } from '../tw';
import { controlA11y, hiddenA11y, testIdProps } from './a11y';
import { HLYNK_COPY } from './copy';
import type { HLynkKeyProps, HLynkKeyRole } from './HLynkKey.types';
import { HLYNK_GEOMETRY } from './layout';
import { useShellHidden } from './hidden-context';
import { assertNever, resolveTier } from './tier';

export type { HLynkKeyProps, HLynkKeyRole };

function glyphFor(role: HLynkKeyRole) {
  switch (role) {
    case 'home':
      return { Icon: Home, label: HLYNK_COPY['hlynk.key.home.label'] };
    case 'menu':
      return { Icon: Menu, label: HLYNK_COPY['hlynk.key.menu.label'] };
    case 'back':
      return { Icon: ChevronLeft, label: HLYNK_COPY['hlynk.key.back.label'] };
    case 'forward':
      return { Icon: ChevronRight, label: HLYNK_COPY['hlynk.key.forward.label'] };
    default:
      return assertNever(role);
  }
}

const KEY = HLYNK_GEOMETRY.keyPt;
const IS_WEB = Platform.OS === 'web';

/**
 * One black key on the red H-Lynk body: home, menu, back or forward, 48 pt
 * square (over the 44 pt / 48 dp targets). The glyph is `silver-300` on black
 * (15.89:1), white while pressed, `concrete-700` when disabled. Full press
 * feedback is a 1 pt depress; reduced is the white glyph alone. Never
 * destructive. A key without a handler stays focusable and named, reads
 * `hlynk.state.disabled.hint`, and does nothing (M01 07-a11y.md).
 */
export function HLynkKey({
  tier = 'core', role, label, onPress, disabled = false, reducedMotion, testID,
}: HLynkKeyProps) {
  resolveTier(tier, 'HLynkKey');
  const { Icon, label: defaultLabel } = glyphFor(role);
  const name = label ?? defaultLabel;
  const off = disabled || !onPress;
  const hiddenShell = useShellHidden();
  // Native press state lives in a per-instance store (repo rule: no useState).
  // Web reads :active from CSS instead.
  const store = useInstanceStore(() => ({ pressed: false }));
  const pressed = useStore(store, (s) => s.pressed);
  const nativePress = IS_WEB || off
    ? {}
    : { onPressIn: () => store.setState({ pressed: true }), onPressOut: () => store.setState({ pressed: false }) };

  const glyph = off
    ? 'text-hlynk-core-glyph-disabled'
    : pressed
      ? 'text-hlynk-core-glyph-pressed'
      : 'text-hlynk-core-glyph group-active:text-hlynk-core-glyph-pressed';
  const depress = off || reducedMotion ? '' : pressed ? 'translate-y-px' : 'active:translate-y-px';

  return (
    <Button
      {...(testIdProps(testID) as object)}
      className={`group items-center justify-center border-0 bg-hlynk-core-black p-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hlynk-core-ink ${depress} ${off ? 'cursor-not-allowed' : 'cursor-pointer'}`}
      style={{ width: KEY, height: KEY }}
      onPress={off ? undefined : () => {
        haptics.tap();
        onPress?.();
      }}
      {...(controlA11y({
        label: name,
        hint: off ? HLYNK_COPY['hlynk.state.disabled.hint'] : undefined,
        disabled: off,
        showsLargeContent: true,
        removeFromTabOrder: hiddenShell,
      }) as object)}
      {...(nativePress as object)}
    >
      <View {...hiddenA11y(true)} className="items-center justify-center">
        <Icon className={glyph} size={24} strokeWidth={2.25} />
      </View>
    </Button>
  );
}
