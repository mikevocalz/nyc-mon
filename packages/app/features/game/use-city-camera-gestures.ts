// Touch input for the city camera on react-native-gesture-handler 3.2.1's
// hook API (verified against node_modules: usePanGesture, usePinchGesture,
// useRotationGesture, useTapGesture, useSimultaneousGestures,
// useExclusiveGestures; `runOnJS` in CommonGestureConfig; pinch `scaleChange`
// is current/previous; rotation `rotationChange` is the per-event delta; pan
// `changeX/changeY` per event and `velocityX/velocityY` in dp/s).
//
// runOnJS: true. The camera store and the renderer both live on the JS thread
// (ThreeCanvas draws from requestAnimationFrame on JS), so a UI-thread worklet
// would only hop back with scheduleOnRN on every event. Revisit if profiling
// shows gesture latency; the scene itself is the cost centre.
//
// Gestures mount on a view that holds ONLY the canvas. HUD buttons are
// siblings outside the detector: RN Pressable (the kit's PressScale) and
// RNGH are never nested in one tree (react-native-best-practices: gestures).
import { useEffect, useRef } from 'react';
import {
  useExclusiveGestures,
  usePanGesture,
  usePinchGesture,
  useRotationGesture,
  useSimultaneousGestures,
  useTapGesture,
} from 'react-native-gesture-handler';
import {
  commandToAction,
  panToAction,
  pinchToAction,
  rotationToAction,
  startPanInertia,
  stepPanInertia,
  type PanInertia,
} from './camera-input.ts';
import { beginViewTurn, endViewTurn } from './character/caller-runtime.ts';
import { callerStore } from './character/caller-store.ts';
import { gameCameraStore } from './game-session.ts';

export interface CityCameraGestureOptions {
  /** Canvas height in dp; pan converts finger travel to ground metres with it. */
  viewportHeight: () => number;
  reducedMotion: boolean;
  /** False while a blocking state (error, unsupported) covers the world. */
  enabled: boolean;
}

export function useCityCameraGestures({ viewportHeight, reducedMotion, enabled }: CityCameraGestureOptions) {
  // Imperative frame handle and fling state: refs, not React state (repo rule).
  const inertia = useRef<{ state: PanInertia | null; frame: number; last: number }>({ state: null, frame: 0, last: 0 });

  const stopInertia = () => {
    if (inertia.current.frame) cancelAnimationFrame(inertia.current.frame);
    inertia.current = { state: null, frame: 0, last: 0 };
  };
  useEffect(() => stopInertia, []);
  // Turning reduced motion on mid-glide stops the glide.
  useEffect(() => { if (reducedMotion) stopInertia(); }, [reducedMotion]);

  const move = gameCameraStore.getState().move;
  const camera = () => gameCameraStore.getState().camera;

  const glide = (now: number) => {
    const current = inertia.current;
    if (!current.state) return;
    const dt = current.last ? (now - current.last) / 1000 : 1 / 60;
    const { changeX, changeY, next } = stepPanInertia(current.state, dt);
    move(panToAction(changeX, changeY, camera(), viewportHeight()));
    current.state = next;
    current.last = now;
    current.frame = next ? requestAnimationFrame(glide) : 0;
  };

  const pan = usePanGesture({
    runOnJS: true,
    enabled,
    // iOS tracks the centroid of all fingers, Android the newest one; average for parity.
    averageTouches: true,
    onBegin: () => stopInertia(),
    // A drag that orbits holds the block settle off until the finger lifts (onFinalize).
    onActivate: () => { if (callerStore.getState().spawned) beginViewTurn('pan'); },
    onFinalize: () => endViewTurn('pan'),
    // With a Caller in the world a one-finger drag orbits around them (the
    // chase camera would pull a pan straight back); before the Caller spawns
    // it pans the map as it always did.
    onUpdate: (e) => {
      if (callerStore.getState().spawned) move({ type: 'orbit', radians: (-e.changeX * Math.PI) / Math.max(1, viewportHeight()) });
      else move(panToAction(e.changeX, e.changeY, camera(), viewportHeight()));
    },
    onDeactivate: (e) => {
      if (e.canceled) return;
      if (callerStore.getState().spawned) return;
      const state = startPanInertia(e.velocityX, e.velocityY, reducedMotion);
      if (!state) return;
      inertia.current = { state, frame: requestAnimationFrame(glide), last: 0 };
    },
  });

  const pinch = usePinchGesture({
    runOnJS: true,
    enabled,
    onBegin: () => stopInertia(),
    onUpdate: (e) => move(pinchToAction(e.scaleChange)),
  });

  const rotate = useRotationGesture({
    runOnJS: true,
    enabled,
    onActivate: () => beginViewTurn('rotate'),
    onFinalize: () => endViewTurn('rotate'),
    onUpdate: (e) => move(rotationToAction(e.rotationChange)),
  });

  // Double tap zooms in one button step: instant, so it needs no reduced-motion variant.
  const doubleTap = useTapGesture({
    runOnJS: true,
    enabled,
    numberOfTaps: 2,
    onDeactivate: (e) => { if (!e.canceled) move(commandToAction('zoomIn', camera())); },
  });

  // Pan + pinch + twist together (map convention); a double tap wins over a drag start.
  const continuous = useSimultaneousGestures(pan, pinch, rotate);
  return useExclusiveGestures(doubleTap, continuous);
}
