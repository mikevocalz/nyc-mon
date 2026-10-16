'use client';
// The top-centre START/STOP pill (Master Directive v2 §2C). The session owns
// every transition: the pill reflects `state` and reports intent through the
// variant's callbacks; it never flips its own legend. STOP is a hold, never
// a tap (§2C rule 3): a touch held for `holdMs` calls `onStopHoldComplete`
// once; a release before that calls `onStopReleased` and nothing else; a
// release inside the tap window is the short press (pause or resume).
// `holdMs` defaults to the contract's STOP_HOLD_MS, the number the hardware
// adapters and the session's ring timer read too.
//
// Housing: `CornerCutFrame corner="all" cut={8}`, 120 × 44 dp, the one
// corner-cut shape on the overlay (arcade-ergonomics.md §8); the perimeter
// illumination and the hold ring are the `start-stop` artboard inside it
// (§8 `pill/state`, `pill/holdProgress`). The touch target is
// 144 × 48 around it. The pill never scales with the profile.
//
// Gesture: react-native-gesture-handler 3.2.1 `useManualGesture` touch
// callbacks as worklets (lib/typescript/v3/types/ConfigTypes.d.ts). The
// press sink and the hold timer run on the UI thread with Reanimated
// `withTiming`; completion fires from the timing's finish callback, so a
// release one frame early never counts. Hold progress reaches Rive through a
// quantized useAnimatedReaction (20 steps, 4 under reduced motion: the
// `07-a11y.md` map), so the ring fills without a JS hop per frame. The
// artboard authors `pill/holdProgress` and keys the ring from it, with its
// own four-step reduced-motion sibling; it keeps no clock of its own.
//
// Decision (BUILD): `onStopHoldStart` is added to the `playing` and `paused`
// variants so the session can enter `stopConfirm` when the hold begins; the
// G01 handoff's `stopConfirm` variant assumes it already knows.
// Decision (BUILD, finding H7): the accessibility "Stop" action opens a
// confirm dialog (kit ResponsiveDialog) and calls `onStopHoldComplete` only
// on its Stop button, then announces g01.a11y.stopped. `07-a11y.md` Focus
// order item 1 asks for the confirm; directive §2C forbids a one-gesture stop.
import { useEffect, useRef } from 'react';
import { AccessibilityInfo } from 'react-native';
import {
  GestureDetector,
  GestureStateManager,
  useManualGesture,
  type GestureTouchEvent,
} from 'react-native-gesture-handler';
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { palette } from '@acme/theme';
import { Button } from '../Button';
import { ResponsiveDialog } from '../ResponsiveDialog';
import { useInstanceStore, useStore } from '../use-instance-store';
import { css } from '../html/css';
import { testIdProps } from '../hlynk/a11y';
import { CornerCutFrame } from '../neon/CornerCutFrame';
import { Text } from '../Text';
import { View } from '../tw';
import { STOP_HOLD_MS } from './contract.ts';
import { ArcadeRiveSurface } from './ArcadeRiveSurface';
import type { ArcadeRiveSource } from './ArcadeRiveSurface.types.ts';
import {
  PILL_ANNOUNCE,
  PILL_LEGEND,
  PILL_SPOKEN,
  PILL_STOPPED,
  PILL_STOP_CONFIRM,
  PILL_STOP_RELEASED,
  pillHint,
  quantizeHoldProgress,
  type StartStopPillState,
} from './start-stop-pill-copy.ts';
import { PILL_GEOMETRY_DP } from './touch-geometry.ts';
import { useRiveBinding } from './use-rive-binding.ts';

export type { StartStopPillState };

interface CommonPillProps {
  /** Authored sibling: no sink, legend cuts instead of cross-fading, the hold ring fills in four steps. */
  readonly reducedMotion: boolean;
  /** The `start-stop` artboard. Absent: the housing, legend and touch target still work. */
  readonly rive?: ArcadeRiveSource;
  readonly testID?: string;
}

/**
 * Props of {@linkcode StartStopPill}, one variant per state so a `start` pill
 * cannot be given a stop handler and a `disabled` pill has none.
 */
export type StartStopPillProps = CommonPillProps &
  (
    | { readonly state: 'start'; readonly onStart: () => void }
    | {
        readonly state: 'playing';
        readonly onPause: () => void;
        readonly onStopHoldStart?: () => void;
        readonly onStopHoldComplete: () => void;
        readonly onStopReleased?: () => void;
        /** Hold needed to stop, in ms. @default {@linkcode STOP_HOLD_MS} (1000) */
        readonly holdMs?: number;
      }
    | {
        readonly state: 'paused';
        readonly onResume: () => void;
        readonly onStopHoldStart?: () => void;
        readonly onStopHoldComplete: () => void;
        readonly onStopReleased?: () => void;
        /** Hold needed to stop, in ms. @default {@linkcode STOP_HOLD_MS} (1000) */
        readonly holdMs?: number;
      }
    | {
        readonly state: 'stopConfirm';
        /** Session-driven ring fill 0…1, written to `pill/holdProgress`; a live touch hold overrides it. */
        readonly progress: number;
        readonly onStopHoldComplete: () => void;
        readonly onStopReleased: () => void;
        /** Hold needed to stop, in ms. @default {@linkcode STOP_HOLD_MS} (1000) */
        readonly holdMs?: number;
      }
    | { readonly state: 'disabled' }
  );

/** A release at or under this many ms after touch-down is the short press. */
export const PILL_TAP_MAX_MS = 300;

const PRESS_MS = 120;
const UNWIND_MS = 200;
const SINK_DP = 2;
const Sink = css(Animated.View, 'StartStopPillSink');

interface PillConfirmStore {
  confirmOpen: boolean;
}

/**
 * Short press pauses or resumes, hold-and-confirm stops, with the ring fill
 * visible through the artboard. The legend is the copy deck's
 * (`g01.pill.*`); the spoken name is the action, not the legend.
 *
 * @see {@linkcode StartStopPillProps} for the per-state contract.
 */
export function StartStopPill(props: StartStopPillProps) {
  const { state, reducedMotion, rive, testID } = props;
  const holdable = state === 'playing' || state === 'paused' || state === 'stopConfirm';
  const holdMs = holdable ? props.holdMs ?? STOP_HOLD_MS : STOP_HOLD_MS;
  const disabled = state === 'disabled';

  const binding = useRiveBinding((b) => {
    if (state !== 'disabled') b.setPillState(state);
    b.setReducedMotion(reducedMotion);
  });
  useEffect(() => {
    binding.write((b) => {
      if (state !== 'disabled') b.setPillState(state);
    });
  }, [binding, state]);
  useEffect(() => { binding.write((b) => b.setReducedMotion(reducedMotion)); }, [binding, reducedMotion]);
  const sessionProgress = state === 'stopConfirm' ? props.progress : undefined;
  useEffect(() => {
    if (sessionProgress === undefined) return;
    binding.write((b) => b.setPillHoldProgress(sessionProgress));
  }, [binding, sessionProgress]);

  // Announce the session's transitions once each (05-copy.md spoken state changes).
  const previous = useRef<StartStopPillState>(state);
  useEffect(() => {
    if (previous.current === state) return;
    previous.current = state;
    const line = PILL_ANNOUNCE[state];
    if (line) AccessibilityInfo.announceForAccessibility(line);
  }, [state]);

  const latest = useRef(props);
  useEffect(() => {
    latest.current = props;
  });

  // JS side of the gesture. Stable identities; the worklets call these through runOnJS.
  const tap = useRef(() => {
    const p = latest.current;
    if (p.state === 'start') p.onStart();
    else if (p.state === 'playing') p.onPause();
    else if (p.state === 'paused') p.onResume();
  }).current;
  const holdStart = useRef(() => {
    const p = latest.current;
    if (p.state === 'playing' || p.state === 'paused') p.onStopHoldStart?.();
  }).current;
  const holdComplete = useRef(() => {
    const p = latest.current;
    if (p.state === 'playing' || p.state === 'paused' || p.state === 'stopConfirm') p.onStopHoldComplete();
  }).current;
  const holdReleased = useRef(() => {
    const p = latest.current;
    if (p.state === 'playing' || p.state === 'paused' || p.state === 'stopConfirm') {
      p.onStopReleased?.();
      AccessibilityInfo.announceForAccessibility(PILL_STOP_RELEASED);
    }
  }).current;
  // The screen-reader "Stop" action asks first (H7); only the dialog's Stop button stops.
  const confirm = useInstanceStore<PillConfirmStore>(() => ({ confirmOpen: false }));
  const confirmOpen = useStore(confirm, (s) => s.confirmOpen);
  useEffect(() => {
    if (!holdable && confirm.getState().confirmOpen) confirm.setState({ confirmOpen: false });
  }, [confirm, holdable]);
  const confirmStop = () => {
    confirm.setState({ confirmOpen: false });
    holdComplete();
    AccessibilityInfo.announceForAccessibility(PILL_STOPPED);
  };
  const cancelStop = () => {
    confirm.setState({ confirmOpen: false });
    AccessibilityInfo.announceForAccessibility(PILL_STOP_RELEASED);
  };

  const writeProgress = useRef((value: number) => {
    binding.write((b) => b.setPillHoldProgress(value));
  }).current;

  const owner = useSharedValue(-1);
  const downAt = useSharedValue(0);
  const sink = useSharedValue(0);
  const progress = useSharedValue(0);
  const completed = useSharedValue(false);

  const gesture = useManualGesture({
    enabled: !disabled,
    onTouchesDown: (e: GestureTouchEvent) => {
      'worklet';
      if (owner.get() !== -1) return;
      const touch = e.changedTouches[0];
      if (!touch) return;
      owner.set(touch.id);
      downAt.set(Date.now());
      completed.set(false);
      sink.set(reducedMotion ? 1 : withTiming(1, { duration: PRESS_MS }));
      GestureStateManager.activate(e.handlerTag);
      if (!holdable) return;
      progress.set(
        withTiming(1, { duration: holdMs, easing: Easing.linear }, (finished) => {
          'worklet';
          if (finished && owner.get() !== -1) {
            completed.set(true);
            runOnJS(holdComplete)();
          }
        }),
      );
      runOnJS(holdStart)();
    },
    onTouchesUp: (e: GestureTouchEvent) => {
      'worklet';
      const current = owner.get();
      if (current === -1 || !e.changedTouches.some((t) => t.id === current)) return;
      const heldMs = Date.now() - downAt.get();
      owner.set(-1);
      sink.set(reducedMotion ? 0 : withTiming(0, { duration: PRESS_MS }));
      cancelAnimation(progress);
      progress.set(reducedMotion ? 0 : withTiming(0, { duration: UNWIND_MS }));
      if (e.numberOfTouches === 0) GestureStateManager.deactivate(e.handlerTag);
      if (completed.get()) return;
      if (heldMs <= PILL_TAP_MAX_MS) runOnJS(tap)();
      else if (holdable) runOnJS(holdReleased)();
    },
    onTouchesCancel: (e: GestureTouchEvent) => {
      'worklet';
      const current = owner.get();
      if (current === -1 || !e.changedTouches.some((t) => t.id === current)) return;
      owner.set(-1);
      sink.set(0);
      cancelAnimation(progress);
      progress.set(0);
      if (holdable && !completed.get()) runOnJS(holdReleased)();
    },
    onFinalize: () => {
      'worklet';
      if (owner.get() === -1) return;
      owner.set(-1);
      sink.set(0);
      cancelAnimation(progress);
      progress.set(0);
      if (holdable && !completed.get()) runOnJS(holdReleased)();
    },
  });

  useAnimatedReaction(
    () => quantizeHoldProgress(progress.get(), reducedMotion),
    (quantized, before) => {
      if (quantized !== before) runOnJS(writeProgress)(quantized);
    },
    [reducedMotion],
  );

  const sinkStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: reducedMotion ? 0 : sink.get() * SINK_DP }],
  }));

  const tone = state === 'start' ? 'orange' : palette.concrete[800];
  const legendClass = state === 'start' ? 'text-on-cta' : 'text-silver-300';

  return (
    <View className="items-center gap-1">
      <GestureDetector gesture={gesture}>
        <View
          {...testIdProps(testID)}
          accessible
          accessibilityRole="button"
          accessibilityLabel={PILL_SPOKEN[state]}
          accessibilityHint={pillHint(state, holdMs)}
          accessibilityState={{ disabled }}
          accessibilityActions={holdable ? [{ name: 'activate' }, { name: 'stop', label: 'Stop' }] : [{ name: 'activate' }]}
          onAccessibilityAction={(event) => {
            if (disabled) return;
            const name = event.nativeEvent.actionName;
            if (name === 'activate') tap();
            else if (name === 'stop') confirm.setState({ confirmOpen: true });
          }}
          className="items-center justify-center"
          // Computed: 144 × 48 target around the 120 × 44 pill (07-a11y.md).
          style={{ width: PILL_GEOMETRY_DP.targetWidth, height: PILL_GEOMETRY_DP.targetHeight }}
        >
          <Sink style={sinkStyle} aria-hidden pointerEvents="none">
            {rive?.file ? (
              // The artboard is the whole pill: housing, legend, ring. Drawing the
              // kit frame and legend under it showed two PAUSE labels on device.
              <View style={{ width: PILL_GEOMETRY_DP.width, height: PILL_GEOMETRY_DP.height }}>
                <ArcadeRiveSurface
                  riveFile={rive?.file}
                  diagnosticsName="start-stop"
                  artboardName={rive?.artboardName}
                  stateMachineName={rive?.stateMachineName}
                  onBinding={binding.onBinding}
                  style={{ position: 'absolute', left: 0, top: 0, width: PILL_GEOMETRY_DP.width, height: PILL_GEOMETRY_DP.height }}
                />
              </View>
            ) : (
            <CornerCutFrame
              corner="all"
              cut={PILL_GEOMETRY_DP.cornerCut}
              depth={disabled ? 0 : 4}
              variant="solid"
              tone={tone}
              className="items-center justify-center"
            >
              <View
                className="items-center justify-center"
                // Computed: the pill is 120 × 44 and never scales (arcade-ergonomics.md §8).
                style={{ width: PILL_GEOMETRY_DP.width, height: PILL_GEOMETRY_DP.height }}
              >
                <Text variant="label" className={`text-type-tag uppercase ${legendClass}`} numberOfLines={1}>
                  {PILL_LEGEND[state]}
                </Text>
              </View>
            </CornerCutFrame>
            )}
          </Sink>
        </View>
      </GestureDetector>
      {state === 'playing' || state === 'paused' ? (
        <Text variant="caption" tone="muted" {...testIdProps(testID ? `${testID}-hint` : undefined)}>
          Hold to stop
        </Text>
      ) : null}
      {holdable ? (
        <ResponsiveDialog
          open={confirmOpen}
          onClose={cancelStop}
          title={PILL_STOP_CONFIRM.title}
          description={PILL_STOP_CONFIRM.description}
          actions={
            <>
              <Button title={PILL_STOP_CONFIRM.cancel} variant="outline" onPress={cancelStop} />
              <Button title={PILL_STOP_CONFIRM.confirm} variant="danger" onPress={confirmStop} />
            </>
          }
        />
      ) : null}
    </View>
  );
}
