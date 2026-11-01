'use client';
// One cap of the six-button cluster (Master Directive v2 §2B): the round touch
// target, its accessibility node and the UI-thread press feedback. The cap
// artwork, sink, glyph and rings are the `right-six` Rive artboard that
// ArcadeSixButtons renders underneath all six caps (§8: one view model with
// `buttons/<id>/state` per cap); this component draws nothing of the cap.
//
// Gesture: react-native-gesture-handler 3.2.1 `useManualGesture` with the
// touch callbacks (lib/typescript/v3/types/ConfigTypes.d.ts: onTouchesDown/
// Move/Up/Cancel on GestureCallbacks; v3/gestureStateManager.d.ts:
// GestureStateManager.activate/fail/deactivate(handlerTag)). Every callback is
// a worklet on the UI thread; the press disc lights there, before the router
// hears about it. Touch events carry no timestamp (handlers/
// gestureHandlerCommon.d.ts TouchData: id, x, y, absoluteX, absoluteY), so the
// stamp is Date.now() taken inside the worklet, then hopped to JS with
// Reanimated's runOnJS (the kit declares Reanimated, not Worklets:
// adaptive-panes/CollapsiblePane.native.tsx).
//
// Pointer ownership: the first finger inside the circle owns the cap until it
// lifts, is cancelled, or leaves the circle (a leave counts as up, G01
// 08-handoff.md § Interaction). A second finger on the same cap is ignored;
// a finger on another cap is another handler with its own pointer, which
// RNGH does not cancel on activation (no common pointers), so chords work.
//
// Decision (BUILD): the UI-thread feedback is a translucent press disc on
// the target, because a transform on one region of a shared artboard is
// impossible. If lane B ships per-cap artboards the disc goes and the
// wrapper transform takes its place.
import { useCallback, useEffect, useRef } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import {
  GestureDetector,
  GestureStateManager,
  useManualGesture,
  type GestureTouchEvent,
} from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { css } from '../html/css';
import { testIdProps } from '../hlynk/a11y';
import { View } from '../tw';
import type { ActionBinding, ButtonId, ButtonVisualState } from './contract.ts';
import { SIX_BUTTON_DIAMETER_DP } from './six-button-arch.ts';
import { insideCircle } from './touch-geometry.ts';
import { mustReleaseOnDisable } from './touch-ownership.ts';

/** Props of {@linkcode ArcadeActionButton}. */
export interface ArcadeActionButtonProps {
  readonly id: ButtonId;
  /** Label, icon and enabled flag. The spoken name defaults to the label until the contract carries one. */
  readonly binding: ActionBinding;
  /**
   * The Rive `buttons/<id>/state` value. An input: the cap never derives it
   * from the router's `heldButtons`; the controller does.
   */
  readonly state: ButtonVisualState;
  /** {@linkcode ControllerProfile.scale} after the layout resolver clamped it. */
  readonly scale: number;
  /** Authored sibling: the press disc appears instantly instead of fading in. */
  readonly reducedMotion: boolean;
  /** The owning finger went down inside the circle. `timestampMs` is the gesture-thread time. */
  readonly onDown: (id: ButtonId, timestampMs: number) => void;
  /** The owning finger lifted, was cancelled, or left the circle. Exactly one per {@linkcode ArcadeActionButtonProps.onDown}. */
  readonly onUp: (id: ButtonId, timestampMs: number) => void;
  /** Screen-reader activation (VoiceOver double tap). Focus alone never calls this. */
  readonly onAccessibilityActivate?: (id: ButtonId) => void;
  /** Spoken name; defaults to `binding.label`. */
  readonly accessibilityLabel?: string;
  readonly testID?: string;
  /** Position inside the cluster; the cluster sets `left`/`top`. */
  readonly style?: StyleProp<ViewStyle>;
}

const PRESS_IN_MS = 120;
const PressDisc = css(Animated.View, 'ArcadeActionButtonDisc');

/**
 * The touch target of one cap. Round hit area, strict one-down-one-up per
 * finger, press feedback on the UI thread, `button` role with the spoken
 * action name. Mount it over the cluster artboard through
 * {@linkcode ArcadeSixButtons}; on its own it is a hit area with no artwork.
 *
 * @see {@linkcode ArcadeSixButtons}
 */
export function ArcadeActionButton({
  id,
  binding,
  state,
  scale,
  reducedMotion,
  onDown,
  onUp,
  onAccessibilityActivate,
  accessibilityLabel,
  testID,
  style,
}: ArcadeActionButtonProps) {
  const diameter = SIX_BUTTON_DIAMETER_DP * scale;
  const radius = diameter / 2;
  const disabled = state === 'disabled' || binding.enabled === false;

  // Latest callbacks behind stable functions, so the worklets never hold a stale closure.
  const latest = useRef({ onDown, onUp });
  useEffect(() => {
    latest.current = { onDown, onUp };
  });
  const down = useCallback((timestampMs: number) => latest.current.onDown(id, timestampMs), [id]);
  const up = useCallback((timestampMs: number) => latest.current.onUp(id, timestampMs), [id]);

  /** Pointer id that owns the cap, −1 when none. Lives on the UI thread. */
  const owner = useSharedValue(-1);
  /** 0 idle, 1 pressed: the disc's opacity. */
  const press = useSharedValue(0);

  const gesture = useManualGesture({
    enabled: !disabled,
    onTouchesDown: (e: GestureTouchEvent) => {
      'worklet';
      if (owner.get() !== -1) return;
      const touch = e.changedTouches[0];
      if (!touch) return;
      if (!insideCircle(touch.x, touch.y, radius, radius, radius)) {
        GestureStateManager.fail(e.handlerTag);
        return;
      }
      owner.set(touch.id);
      press.set(reducedMotion ? 1 : withTiming(1, { duration: PRESS_IN_MS }));
      GestureStateManager.activate(e.handlerTag);
      runOnJS(down)(Date.now());
    },
    onTouchesMove: (e: GestureTouchEvent) => {
      'worklet';
      const current = owner.get();
      if (current === -1) return;
      const touch = e.allTouches.find((t) => t.id === current);
      if (!touch) return;
      if (insideCircle(touch.x, touch.y, radius, radius, radius)) return;
      // Left the circle: counts as up. The handler ends; RNGH resets it when every finger lifts.
      owner.set(-1);
      press.set(reducedMotion ? 0 : withTiming(0, { duration: PRESS_IN_MS }));
      GestureStateManager.deactivate(e.handlerTag);
      runOnJS(up)(Date.now());
    },
    onTouchesUp: (e: GestureTouchEvent) => {
      'worklet';
      const current = owner.get();
      if (current === -1 || !e.changedTouches.some((t) => t.id === current)) return;
      owner.set(-1);
      press.set(reducedMotion ? 0 : withTiming(0, { duration: PRESS_IN_MS }));
      if (e.numberOfTouches === 0) GestureStateManager.deactivate(e.handlerTag);
      runOnJS(up)(Date.now());
    },
    onTouchesCancel: (e: GestureTouchEvent) => {
      'worklet';
      const current = owner.get();
      if (current === -1 || !e.changedTouches.some((t) => t.id === current)) return;
      owner.set(-1);
      press.set(0);
      runOnJS(up)(Date.now());
    },
    onFinalize: () => {
      'worklet';
      // The system cancelled the handler (interruption, a parent took over) with the finger still owning the cap.
      if (owner.get() === -1) return;
      owner.set(-1);
      press.set(0);
      runOnJS(up)(Date.now());
    },
  });

  // Disabling mid-press releases: the gesture is torn down by `enabled`, and an
  // owned cap with no `up` would stay held in the router (M4).
  useEffect(() => {
    if (!disabled || !mustReleaseOnDisable(owner.get())) return;
    owner.set(-1);
    press.set(0);
    up(Date.now());
  }, [disabled, owner, press, up]);

  const discStyle = useAnimatedStyle(() => ({ opacity: press.get() }));

  const held = state === 'held';
  const label = accessibilityLabel ?? binding.label;
  const stateHint =
    state === 'cooldown' ? 'Not ready' : state === 'disabled' ? 'Not available' : held ? 'Held' : undefined;

  return (
    <GestureDetector gesture={gesture}>
      <View
        {...testIdProps(testID)}
        accessible
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={stateHint}
        accessibilityState={{ disabled, selected: held }}
        aria-pressed={held}
        accessibilityActions={[{ name: 'activate' }]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'activate' && !disabled) onAccessibilityActivate?.(id);
        }}
        className={`absolute items-center justify-center rounded-full ${held ? 'border-2 border-carolina-500' : ''}`}
        // Computed: the cap's diameter follows the profile scale (arcade-ergonomics.md §7).
        style={[{ width: diameter, height: diameter }, style]}
      >
        <PressDisc
          pointerEvents="none"
          aria-hidden
          className="absolute inset-0 rounded-full bg-signage-white/15"
          style={discStyle}
        />
      </View>
    </GestureDetector>
  );
}
