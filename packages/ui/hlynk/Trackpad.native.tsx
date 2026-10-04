'use client';
import type { AccessibilityActionEvent } from 'react-native';
import { haptics } from '../haptics';
import { View } from '../tw';
import { HLYNK_COPY } from './copy';
import { useTrackpadGesture } from './trackpad-gesture';
import type { TrackpadProps } from './Trackpad.types';
import { TrackpadFace, trackpadSize } from './TrackpadFace';
import { resolveTier } from './tier';

export type { TrackpadProps };

/**
 * PLATFORM FORK (native): an `adjustable` element. VoiceOver/TalkBack swipe
 * up/down is increment/decrement (step), double-tap is activate, and the
 * commit is a named custom action, so hold has a timeout-free route.
 */
export function Trackpad(props: TrackpadProps) {
  const {
    tier = 'core', label, hint, onActivate, onStep, onPan, accent = 'ring', disabled = false,
    reducedMotion, shape = 'square', sizePt, testID, onCommit, commitLabel,
  } = props;
  resolveTier(tier, 'Trackpad');
  const { responder, pressed } = useTrackpadGesture({ onActivate, onStep, onCommit, onPan }, disabled, true);

  const actions = disabled
    ? []
    : [
        ...(onActivate ? [{ name: 'activate' }] : []),
        ...(onStep ? [{ name: 'increment' }, { name: 'decrement' }] : []),
        ...(onCommit && commitLabel ? [{ name: 'commit', label: commitLabel }] : []),
      ];
  const onAccessibilityAction = (e: AccessibilityActionEvent) => {
    switch (e.nativeEvent.actionName) {
      case 'activate':
        haptics.tap();
        return onActivate?.();
      case 'increment':
        haptics.selection();
        return onStep?.(1);
      case 'decrement':
        haptics.selection();
        return onStep?.(-1);
      case 'commit':
        haptics.success();
        return onCommit?.();
      default:
        return undefined;
    }
  };

  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label || HLYNK_COPY['hlynk.trackpad.label']}
      accessibilityHint={disabled ? HLYNK_COPY['hlynk.state.disabled.hint'] : hint}
      accessibilityState={{ disabled }}
      accessibilityActions={actions}
      onAccessibilityAction={onAccessibilityAction}
      style={trackpadSize(shape, sizePt)}
      {...responder}
    >
      <TrackpadFace shape={shape} sizePt={sizePt} accent={accent} disabled={disabled} pressed={pressed} reducedMotion={reducedMotion} />
    </View>
  );
}
