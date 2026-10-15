'use client';
import type React from 'react';
import { Button } from '../html';
import { haptics } from '../haptics';
import { View } from '../tw';
import { controlA11y, testIdProps } from './a11y';
import { HLYNK_COPY } from './copy';
import { useOneBreath, useTrackpadGesture } from './trackpad-gesture';
import type { TrackpadProps } from './Trackpad.types';
import { TrackpadFace, trackpadSize } from './TrackpadFace';
import { useShellHidden } from './hidden-context';
import { resolveTier } from './tier';

export type { TrackpadProps };

/**
 * PLATFORM FORK (web): a real `<button>`. Click and Enter/Space activate,
 * ArrowLeft/ArrowRight step. Pointer flicks, holds and pans run through the
 * responder handlers on the wrapper; a click that ends one of those gestures
 * is swallowed so it does not also activate. Disabled stays focusable
 * (`aria-disabled`).
 */
export function Trackpad(props: TrackpadProps) {
  const {
    tier = 'core', label, hint, onActivate, onStep, onPan, accent = 'ring', disabled = false,
    reducedMotion, shape = 'square', sizePt, testID, onCommit, onHoldStart, onHoldEnd,
  } = props;
  resolveTier(tier, 'Trackpad');
  const hiddenShell = useShellHidden();
  const { responder, pressed, shouldSwallowClick } = useTrackpadGesture(
    { onActivate, onStep, onCommit, onPan, onHoldStart, onHoldEnd },
    disabled,
    false,
  );
  const breath = useOneBreath(onHoldStart, onHoldEnd);
  const onKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (disabled || !onStep) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      haptics.selection();
      onStep(event.key === 'ArrowLeft' ? -1 : 1);
    }
  };
  const size = trackpadSize(shape, sizePt);
  return (
    <View style={size} {...responder}>
      <Button
        {...(testIdProps(testID) as object)}
        className={`items-center justify-center border-0 bg-transparent p-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hlynk-core-ink ${shape === 'pill' ? 'rounded-full' : ''} ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
        style={size}
        onKeyDown={onKeyDown}
        onPress={disabled ? undefined : () => {
          if (shouldSwallowClick()) return;
          haptics.tap();
          // Hold-only pad: Enter / click runs one breath of the hold.
          if (onActivate) onActivate();
          else breath();
        }}
        {...(controlA11y({
          label: label || HLYNK_COPY['hlynk.trackpad.label'],
          hint: disabled ? HLYNK_COPY['hlynk.state.disabled.hint'] : hint,
          disabled,
          removeFromTabOrder: hiddenShell,
        }) as object)}
        {...(onStep && !disabled ? { 'aria-keyshortcuts': 'ArrowLeft ArrowRight' } : {})}
      >
        <TrackpadFace shape={shape} sizePt={sizePt} accent={accent} disabled={disabled} pressed={pressed} reducedMotion={reducedMotion} />
      </Button>
    </View>
  );
}
