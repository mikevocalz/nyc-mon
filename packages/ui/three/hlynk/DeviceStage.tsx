'use client';

import { useMemo, useRef, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { useInView } from '../../backgrounds/use-in-view';
import { useReducedMotion } from '../../backgrounds/use-reduced-motion';
import { Figcaption, Figure } from '../../html';
import { Image, type ImageProps } from '../../Image';
import { View } from '../../tw';
import { useInstanceStore, useStore } from '../../use-instance-store';
import { ThreeCanvas } from '../ThreeCanvas';
import { loopPlan } from '../loop-policy';
import type { ThreeBackend, ThreeSetup } from '../types';
import type { DeviceSceneParams } from './device-scene';
import type { DeviceScreen } from './screen';
import { useSoundEnabled } from '../../device-preferences';
import { playSideKeyChirp, primeSideKeyChirp } from './side-key-chirp';
import { initialStageState, keyTarget, type DeviceKey } from './stage-state';

/** How far a press moves before it is a drag (pan), pt. Matches the 2D trackpad's slop. */
const DRAG_SLOP_PT = 8;

/** The static capture: a render of the scene at its rest pose, on the stage's ink. */
export interface DeviceCapture {
  src: ImageProps['src'];
  width: number;
  height: number;
  sizes: string;
}

/** What `children` can do to the stage: the side key and the front keys, for controls over or under it. */
export interface DeviceStageApi {
  /** Press the side key: the 3D key dips and, with sound on, chirps. */
  pressSideKey: () => void;
  /** Press a front key as if tapped on the 3D H-Lynk: the key dips (when it has one) and `onKey` runs. */
  pressKey: (key: DeviceKey) => void;
}

export interface DeviceStageProps {
  /** What the glass shows and what a tap there selects (createHudScreen, createChoiceScreen). Keep its identity stable. */
  screen: DeviceScreen;
  /** `placeholder`: the procedural H-Lynk Core. `h-lynk-entry`: the real model, same frame. */
  model?: DeviceSceneParams['model'];
  /**
   * Shown before the canvas mounts, under reduced motion, and if no GPU
   * backend starts. Without one the stage shows `fallback` in those cases.
   */
  capture?: DeviceCapture;
  /** Rendered in the stage when there is no capture and the canvas can't run (reduced motion, no GPU). */
  fallback?: ReactNode;
  /** Visible caption under the stage. */
  caption?: string;
  /** Accessible name of the stage figure. */
  label: string;
  /** Classes for the figure (width, placement). */
  className?: string;
  /** Classes for the stage box. Default: a 4:5 box the figure's width. */
  stageClassName?: string;
  /**
   * Side key sound. The chirp only plays from a press. Omitted, it follows the
   * Caller's Sound setting (device-preferences.ts, M19); either way Sound off wins.
   */
  sound?: boolean;
  /** Called after each side key press (3D key or `pressSideKey`). */
  onSideKey?: () => void;
  /**
   * Called after each front-key press: the 3D `<` (`prev`), `>` (`next`),
   * home, menu and trackpad (`activate`), or `pressKey` (which also sends `back`).
   */
  onKey?: (key: DeviceKey) => void;
  /** Called once the first frame with the H-Lynk in it is on screen. */
  onReady?: () => void;
  /** The backend once the renderer is up, or null when it falls back. */
  onBackendChange?: (backend: ThreeBackend | null) => void;
  /** Controls under the stage. A function gets the stage's side key. */
  children?: ReactNode | ((stage: DeviceStageApi) => ReactNode);
  testID?: string;
  captureTestID?: string;
  /** Backing-store scale of the glass canvas (2 on tablets for crisp text). Read when the scene builds. Default 1. */
  glassScale?: number;
  /** The live beam and its glitter. Default true; false lets an idle stage with no model go still and stop its loop. */
  beam?: boolean;
  /** Called once every screen model is really on the glass (or missing/failed); no 8 s give-up. */
  onModelsSettled?: () => void;
  /**
   * Holds the loop while something covers the stage (a loader): only the
   * frames the scene asks for (compile done, a model landing) draw, and the
   * intro's clock waits, so the intro plays when the cover lifts.
   */
  hold?: boolean;
  /**
   * A drag on the 3D trackpad, in pt since the last call (M13's room pan).
   * Pair it with a screen whose `padPans` is true, so a drag never also
   * activates.
   */
  onPan?: (dxPt: number, dyPt: number) => void;
}

// Module-level and stable, so three.js and the scene stay out of the first chunk.
const loadDeviceScene = (): Promise<ThreeSetup<DeviceSceneParams>> =>
  import('./device-scene').then((m) => m.createDeviceScene);

/** Capture → canvas cross-fade, ms. A style transition, so it adds no frame loop. */
const HANDOFF_MS = 400;

/**
 * The H-Lynk Core in 3D (PS-017) with a live screen (PS-037), one component
 * on web and native: the website's H-LYNK section shows the HUD on it, the
 * app's egg choice (M08) shows the three eggs. The screen is the only thing
 * that differs; the body, the lights, the intro, the pointer tilt, the side
 * key and the tap-to-select raycast are the same scene. The glass is drawn
 * by a 2D canvas on web and by Skia on native (canvas2d.ts / .native.ts).
 *
 * Near the viewport (always, on native) the canvas mounts under the capture,
 * compiles its pipelines off the frame path, and only after its first full
 * frame does the capture fade out. Under reduced motion, or if no GPU
 * backend starts, the capture (or `fallback`) stays.
 *
 * One store per stage holds the hover target and the press counters. The
 * scene plays one intro at the display rate, then drops to 30 fps while only
 * the beam and idling models move, and stops when nothing does; a pointer
 * over the stage wakes it for the tilt (at most 8 degrees). Offscreen or
 * backgrounded it is paused too.
 */
export function DeviceStage({
  screen, model = 'placeholder', capture, fallback = null, caption, label, className, stageClassName,
  sound: soundProp, onSideKey, onKey, onReady, onBackendChange, children, testID, captureTestID, glassScale = 1, beam = true, onModelsSettled, hold = false, onPan,
}: DeviceStageProps) {
  const { ref, hasBeenNear, isVisible } = useInView({ nearMarginPx: 600 });
  const reducedMotion = useReducedMotion();
  const soundSetting = useSoundEnabled();
  const sound = soundProp ?? soundSetting;
  const live = hasBeenNear && !reducedMotion;

  const stage = useInstanceStore(initialStageState);
  const ready = useStore(stage, (s) => s.ready);
  const motion = useStore(stage, (s) => s.motion);
  const pointing = useStore(stage, (s) => s.hover !== null);

  const params = useMemo<DeviceSceneParams>(() => {
    const pressSideKey = () => {
      if (sound) playSideKeyChirp();
      stage.setState({ presses: stage.getState().presses + 1 });
      onSideKey?.();
    };
    const pressKey = (key: DeviceKey) => {
      stage.setState({ keyPresses: stage.getState().keyPresses + 1, lastKey: key });
      onKey?.(key);
    };
    return {
      model,
      screen,
      store: stage,
      onSideKey: pressSideKey,
      onKey: pressKey,
      onReady: () => {
        stage.setState({ ready: true });
        onReady?.();
      },
      onRest: (rest) => stage.setState({ resting: rest }),
      onMotion: (next) => stage.setState({ motion: next }),
      onModelsSettled: () => onModelsSettled?.(),
      glassScale,
      beam,
    };
  }, [model, screen, stage, sound, onSideKey, onKey, onReady, onModelsSettled, glassScale, beam]);
  // On-demand rendering (loop-policy.ts): display rate while something eases
  // or the pointer drives the tilt, 30 fps while only the idle clip and the
  // beam move, stopped when still. ThreeCanvas also stops offscreen and while
  // the app is backgrounded (useOnScreen).
  const plan = loopPlan(hold ? 'still' : motion, isVisible);
  const api = useMemo<DeviceStageApi>(
    () => ({ pressSideKey: () => params.onSideKey?.(), pressKey: (key) => params.onKey?.(key) }),
    [params],
  );
  const release = () => {
    drag.current = null;
    if (stage.getState().held) stage.setState({ held: false });
  };
  // Where the press started and was last seen, for the trackpad drag (a ref: per-move, never rendered).
  const drag = useRef<{ x0: number; y0: number; x: number; y: number } | null>(null);
  const press = (x: number, y: number) => {
    drag.current = { x0: x, y0: y, x, y };
    stage.setState({ taps: stage.getState().taps + 1, held: true, dragged: false });
  };
  const move = (x: number, y: number) => {
    const d = drag.current;
    if (d === null || onPan === undefined) return;
    const st = stage.getState();
    if (!st.held || st.hover !== keyTarget('activate')) return;
    if (!st.dragged && Math.hypot(x - d.x0, y - d.y0) < DRAG_SLOP_PT) return;
    if (!st.dragged) stage.setState({ dragged: true });
    onPan(x - d.x, y - d.y);
    d.x = x;
    d.y = y;
  };

  const showCover = !live || !ready;
  const cover = capture ? (
    <Image
      src={capture.src}
      alt=""
      fill
      framed={false}
      sizes={capture.sizes}
      loading="lazy"
      className="h-full w-full"
    />
  ) : live ? null : fallback;

  return (
    <Figure aria-label={label} data-testid={testID} className={`m-0 w-full gap-3 ${className ?? ''}`}>
      <View
        ref={ref}
        className={`relative overflow-hidden bg-ink-950 ${stageClassName ?? 'aspect-[4/5] w-full'} ${pointing ? 'cursor-pointer' : ''}`}
        // Count the press for the scene (it raycasts once per press). The 3D
        // side key chirps from a scene frame, after the gesture, so unlock
        // audio inside the gesture itself and every browser lets it play.
        // `held` lasts until the pointer lifts or leaves: the trackpad's hold warms the egg (M10).
        onPointerDown={(e) => {
          if (sound) primeSideKeyChirp();
          press(e.nativeEvent.pageX, e.nativeEvent.pageY);
        }}
        onPointerMove={(e) => move(e.nativeEvent.pageX, e.nativeEvent.pageY)}
        onPointerUp={release}
        onPointerCancel={release}
        onPointerLeave={release}
        // Native: pointer events may not reach this view, so a touch counts the press too
        // (two counts in one frame still make one tap: the scene only checks for a change).
        {...(Platform.OS === 'web' ? {} : {
          onTouchStart: (e: { nativeEvent: { pageX: number; pageY: number } }) => press(e.nativeEvent.pageX, e.nativeEvent.pageY),
          onTouchMove: (e: { nativeEvent: { pageX: number; pageY: number } }) => move(e.nativeEvent.pageX, e.nativeEvent.pageY),
          onTouchEnd: release,
          onTouchCancel: release,
        })}
      >
        {live ? (
          <ThreeCanvas
            load={loadDeviceScene}
            params={params}
            paused={plan.paused}
            maxFps={plan.maxFps}
            maxPixelRatio={1.5}
            className="absolute inset-0"
            onBackendChange={onBackendChange}
            fallback={capture ? null : fallback}
          />
        ) : null}
        {cover ? (
          <View
            testID={captureTestID}
            aria-hidden
            className="pointer-events-none absolute inset-0"
            // Computed: the hand-off fade follows the scene's ready signal.
            style={{ opacity: showCover ? 1 : 0, transitionProperty: 'opacity', transitionDuration: `${HANDOFF_MS}ms` }}
          >
            {cover}
          </View>
        ) : null}
      </View>
      {typeof children === 'function' ? children(api) : children}
      {caption ? <Figcaption className="text-sm leading-6 text-text-muted">{caption}</Figcaption> : null}
    </Figure>
  );
}
