'use client';
import { useEffect, useRef } from 'react';
import type { GestureResponderEvent } from 'react-native';
import { haptics } from '../haptics';
import { useInstanceStore, useStore } from '../use-instance-store';

/** Thresholds for classifying a trackpad touch, in points and milliseconds. */
export const TRACKPAD_GESTURE = {
  /** movement under this is still a tap or hold */
  slopPt: 10,
  /** horizontal travel that counts as a flick */
  flickPt: 24,
  /** hold to commit */
  holdMs: 600,
  /** a click arriving this soon after a gesture belongs to that gesture */
  clickSwallowMs: 400,
} as const;

/** What a released touch meant. Produced by {@linkcode classifyRelease}. */
export type TrackpadOutcome = 'activate' | 'step-back' | 'step-forward' | 'none';

/** Classify a touch that ended without a hold commit or a pan. Pure. */
export function classifyRelease(dxPt: number, dyPt: number): TrackpadOutcome {
  const ax = Math.abs(dxPt);
  if (ax >= TRACKPAD_GESTURE.flickPt && ax > Math.abs(dyPt)) return dxPt < 0 ? 'step-back' : 'step-forward';
  if (ax < TRACKPAD_GESTURE.slopPt && Math.abs(dyPt) < TRACKPAD_GESTURE.slopPt) return 'activate';
  return 'none';
}

interface Handlers {
  onActivate?: () => void;
  onStep?: (direction: -1 | 1) => void;
  onCommit?: () => void;
  onPan?: (dxPt: number, dyPt: number) => void;
}

/**
 * Responder handlers for the trackpad face (the React Native responder
 * system, which react-native-web implements too). Tap, flick, hold and pan.
 * `activateOnTap: false` leaves taps to a real button's click (web), and
 * `shouldSwallowClick()` tells that click whether a gesture already used it.
 */
export function useTrackpadGesture(h: Handlers, disabled: boolean, activateOnTap: boolean) {
  const store = useInstanceStore(() => ({ pressed: false }));
  const pressed = useStore(store, (s) => s.pressed);
  const latest = useRef(h);
  useEffect(() => {
    latest.current = h;
  });
  const t = useRef({ x0: 0, y0: 0, lx: 0, ly: 0, panning: false, committed: false, endedAt: 0, consumed: false });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const clear = () => {
    if (timer.current !== undefined) clearTimeout(timer.current);
    timer.current = undefined;
  };
  const finish = (consumed: boolean) => {
    clear();
    store.setState({ pressed: false });
    t.current.endedAt = Date.now();
    t.current.consumed = consumed;
  };

  const responder = disabled
    ? {}
    : {
        onStartShouldSetResponder: () => true,
        onMoveShouldSetResponder: () => true,
        onResponderTerminationRequest: () => false,
        onResponderGrant: (e: GestureResponderEvent) => {
          const { pageX, pageY } = e.nativeEvent;
          t.current = { ...t.current, x0: pageX, y0: pageY, lx: pageX, ly: pageY, panning: false, committed: false };
          store.setState({ pressed: true });
          clear();
          if (latest.current.onCommit) {
            timer.current = setTimeout(() => {
              timer.current = undefined;
              if (t.current.panning) return;
              t.current.committed = true;
              haptics.success();
              latest.current.onCommit?.();
            }, TRACKPAD_GESTURE.holdMs);
          }
        },
        onResponderMove: (e: GestureResponderEvent) => {
          const { pageX, pageY } = e.nativeEvent;
          const s = t.current;
          const moved = Math.hypot(pageX - s.x0, pageY - s.y0) >= TRACKPAD_GESTURE.slopPt;
          if (moved) clear();
          if (latest.current.onPan && moved) {
            s.panning = true;
            latest.current.onPan(pageX - s.lx, pageY - s.ly);
          }
          s.lx = pageX;
          s.ly = pageY;
        },
        onResponderRelease: (e: GestureResponderEvent) => {
          const s = t.current;
          if (s.committed || s.panning) return finish(true);
          const outcome = classifyRelease(e.nativeEvent.pageX - s.x0, e.nativeEvent.pageY - s.y0);
          switch (outcome) {
            case 'activate':
              if (activateOnTap) {
                haptics.tap();
                latest.current.onActivate?.();
              }
              return finish(activateOnTap);
            case 'step-back':
            case 'step-forward':
              haptics.selection();
              latest.current.onStep?.(outcome === 'step-back' ? -1 : 1);
              return finish(true);
            case 'none':
              return finish(true);
            default:
              return outcome satisfies never;
          }
        },
        onResponderTerminate: () => finish(true),
      };

  const shouldSwallowClick = () => {
    const swallow = t.current.consumed && Date.now() - t.current.endedAt < TRACKPAD_GESTURE.clickSwallowMs;
    t.current.consumed = false;
    return swallow;
  };

  return { responder, pressed, shouldSwallowClick };
}
