'use client';
// The website's city walk: the Game world (load-game-scene.ts, the same scene, cell release and storefront plan the
// app draws) with a guest camera. Web only; the native Game tab stays GameScreen (decision record:
// docs/implementation/city-walk-web.md).
//
// What is shared with GameScreen: ThreeCanvas, loadGameScene, the camera store and its clamps, the view states
// (resolveGameViewState) and the staged load bar (gameScreenStore.loadProgress). What is not: the lobby, the Caller,
// the session and its save, the arcade controller. A guest has no Caller, and the website has no sign-up that could
// give it one, so the walk moves the camera only and writes nothing.
//
// Input: keyboard (walk-keys.ts) while the stage has focus, pointer drag/pinch/twist (walk-pointer.ts), the wheel, and
// the on-screen buttons. All of it ends in gameCameraStore.move, and every camera change asks the paused canvas for one
// redraw, so an idle city draws nothing.
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { useWindowDimensions } from 'react-native';
import { useStore } from 'zustand';
import { Button, EmptyState, IconButton } from '@acme/ui';
import { useGpuSupport, type GpuSupport } from '@acme/ui/gpu';
import { ChevronDown, ChevronLeft, ChevronRight, Compass, Minus, Plus, Redo2, Undo2 } from '@acme/ui/icons';
import { ProgressBar } from '@acme/ui/progress';
import { ThreeCanvas, type ThreeCanvasHandle } from '@acme/ui/three';
import { VisuallyHidden } from '@acme/ui/html';
import { View } from '@acme/ui/tw';
import { brand } from '@acme/theme';
import { commandToAction, type CameraCommand } from '../camera-input.ts';
import { bundledCity } from '../city-data.ts';
import { gameCameraStore, gameScreenActions, gameScreenStore } from '../game-session.ts';
import { resolveGameViewState, shouldMountCanvas } from '../game-status.ts';
import { livingCityActorFactories, livingCitySky } from '../living-city/bundled-host.ts';
import { loadGameScene, type GameSceneParams } from '../load-game-scene.ts';
import { budgetedPixelRatio } from '../perf/pixel-budget.ts';
import { physicalRendererParams } from '../world/physical-look.ts';
import { onTimeOfDayChange, timeOfDayStore } from '../world/time-of-day.store.ts';
import { CITY_WALK_COPY as COPY } from './copy.ts';
import { actionsForFrame, intentForKey, wheelToAction, type WalkIntent } from './walk-keys.ts';
import { pointerActions, type PointerPoint } from './walk-pointer.ts';

const RENDERER_PARAMS = physicalRendererParams();

/** WebGL 2 is the fallback ThreeCanvas takes without WebGPU; with neither, the city cannot draw. */
let webgl2: boolean | null = null;
function hasWebGL2(): boolean {
  if (webgl2 !== null) return webgl2;
  try {
    webgl2 = typeof document !== 'undefined' && document.createElement('canvas').getContext('webgl2') !== null;
  } catch {
    webgl2 = false;
  }
  return webgl2;
}

/** The view states read GPU support as "can this draw at all"; on the web, WebGL 2 counts. */
export function walkGpuSupport(webgpu: GpuSupport, webgl2Available: boolean): GpuSupport {
  if (webgpu === 'pending') return 'pending';
  return webgpu === 'supported' || webgl2Available ? 'supported' : 'unsupported';
}

const move = (command: CameraCommand) => {
  const { camera, move: apply } = gameCameraStore.getState();
  apply(commandToAction(command, camera));
};

/** The on-screen pad, three rows of three, read left to right. */
const PAD: readonly (readonly { command: CameraCommand; label: string; icon: React.ReactNode }[])[] = [
  [
    { command: 'rotateLeft', label: COPY.controls.turnLeft, icon: <Undo2 size={20} className="text-text" aria-hidden /> },
    { command: 'moveForward', label: COPY.controls.forward, icon: <ChevronDown size={22} className="rotate-180 text-text" aria-hidden /> },
    { command: 'rotateRight', label: COPY.controls.turnRight, icon: <Redo2 size={20} className="text-text" aria-hidden /> },
  ],
  [
    { command: 'moveLeft', label: COPY.controls.left, icon: <ChevronLeft size={22} className="text-text" aria-hidden /> },
    { command: 'reset', label: COPY.controls.reset, icon: <Compass size={20} className="text-text" aria-hidden /> },
    { command: 'moveRight', label: COPY.controls.right, icon: <ChevronRight size={22} className="text-text" aria-hidden /> },
  ],
  [
    { command: 'zoomOut', label: COPY.controls.zoomOut, icon: <Minus size={20} className="text-text" aria-hidden /> },
    { command: 'moveBack', label: COPY.controls.back, icon: <ChevronDown size={22} className="text-text" aria-hidden /> },
    { command: 'zoomIn', label: COPY.controls.zoomIn, icon: <Plus size={20} className="text-text" aria-hidden /> },
  ],
];

/** Input bookkeeping: refs, not React state (repo rule), so a held key or a moving finger never re-renders. */
interface InputRefs {
  held: Set<WalkIntent>;
  frame: number;
  last: number;
  pointers: Map<number, PointerPoint>;
}

const noopSubscribe = () => () => {};

export default function CityWalkStage() {
  const city = bundledCity();
  const webgpu = useGpuSupport();
  const gl2 = useSyncExternalStore(noopSubscribe, hasWebGL2, () => true);
  const windowSize = useWindowDimensions();
  const canvas = useRef<ThreeCanvasHandle>(null);
  const stage = useRef<unknown>(null);
  const input = useRef<InputRefs>({ held: new Set(), frame: 0, last: 0, pointers: new Map() });

  const screen = useStore(gameScreenStore);
  const progress = screen.loadProgress;
  const state = resolveGameViewState({
    dataset: city.ok ? 'ok' : 'error',
    gpu: walkGpuSupport(webgpu, gl2),
    canvasFailed: screen.canvasFailed,
    firstFrame: screen.firstFrame,
    // Not the bundled tile's bounds (city-bounds.ts): the walk draws Valdrada's streamed rings and far tier, which
    // cover every point the camera store's ±2000 m clamp can reach, so "nothing mapped here" would be false.
    overMappedArea: true,
  });
  const worldReady = state === 'ready' || state === 'empty';

  // A fresh mount has drawn nothing: a first frame from an earlier visit must not count.
  useEffect(() => {
    gameScreenActions.resetForMount();
  }, []);
  useEffect(() => gameCameraStore.subscribe(() => canvas.current?.invalidate()), []);
  useEffect(() => onTimeOfDayChange(timeOfDayStore, () => canvas.current?.invalidate()), []);

  const params = useMemo<GameSceneParams | null>(() => {
    if (!city.ok) return null;
    return {
      dataset: city.dataset,
      get camera() { return gameCameraStore.getState().camera; },
      // No Caller on the website: the guest walk has no session to drive one.
      actors: [...livingCityActorFactories()],
      sky: livingCitySky(),
      get preset() { return timeOfDayStore.getState().preset; },
      onFirstFrame: gameScreenActions.firstFrame,
    };
  }, [city]);

  // Keyboard, pointer and wheel, on the stage element itself: the page keeps its own keys and scroll elsewhere.
  useEffect(() => {
    const el = stage.current as HTMLElement | null;
    if (!el || !worldReady) return;
    const refs = input.current;
    const viewportHeight = () => el.getBoundingClientRect().height;

    const tick = (now: number) => {
      const dt = refs.last ? (now - refs.last) / 1000 : 0;
      refs.last = now;
      const { camera, move: apply } = gameCameraStore.getState();
      for (const action of actionsForFrame(refs.held, camera, dt)) apply(action);
      refs.frame = refs.held.size > 0 ? requestAnimationFrame(tick) : 0;
    };
    const stopKeys = () => {
      refs.held.clear();
      if (refs.frame) cancelAnimationFrame(refs.frame);
      refs.frame = 0;
      refs.last = 0;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const intent = intentForKey(event.code);
      if (intent === null) return;
      event.preventDefault();
      if (intent === 'reset') {
        if (!event.repeat) move('reset');
        return;
      }
      refs.held.add(intent);
      if (!refs.frame) {
        refs.last = 0;
        refs.frame = requestAnimationFrame(tick);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      const intent = intentForKey(event.code);
      if (intent !== null && intent !== 'reset') refs.held.delete(intent);
    };

    const ordered = () => [...refs.pointers.values()];
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      // Buttons on the stage handle their own presses.
      if ((event.target as Element | null)?.closest?.('[data-walk-control]')) return;
      el.setPointerCapture?.(event.pointerId);
      refs.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!refs.pointers.has(event.pointerId)) return;
      const before = ordered();
      refs.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const { camera, move: apply } = gameCameraStore.getState();
      for (const action of pointerActions(before, ordered(), camera, viewportHeight())) apply(action);
    };
    const onPointerEnd = (event: PointerEvent) => {
      refs.pointers.delete(event.pointerId);
    };
    const onWheel = (event: WheelEvent) => {
      const action = wheelToAction(event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY);
      if (!action) return;
      event.preventDefault();
      gameCameraStore.getState().move(action);
    };

    el.addEventListener('keydown', onKeyDown);
    el.addEventListener('keyup', onKeyUp);
    el.addEventListener('blur', stopKeys);
    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerEnd);
    el.addEventListener('pointercancel', onPointerEnd);
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      stopKeys();
      refs.pointers.clear();
      el.removeEventListener('keydown', onKeyDown);
      el.removeEventListener('keyup', onKeyUp);
      el.removeEventListener('blur', stopKeys);
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerEnd);
      el.removeEventListener('pointercancel', onPointerEnd);
      el.removeEventListener('wheel', onWheel);
    };
  }, [worldReady]);

  const blocking =
    state === 'unsupported' ? { ...COPY.unsupported, action: null }
    : state === 'data-error' ? { ...COPY.dataError, action: null }
    : state === 'render-error'
      ? { ...COPY.renderError, action: <Button district="harlem" title={COPY.renderError.action} onPress={gameScreenActions.retry} /> }
      : null;

  return (
    <View
      ref={stage as never}
      // The focusable, named map. role="application" hands the arrow keys to the map while it has focus.
      {...({ tabIndex: 0, role: 'application', 'aria-roledescription': 'map' } as object)}
      aria-label={COPY.stageLabel}
      aria-describedby="city-walk-keys"
      aria-busy={state === 'loading'}
      className="scheme-dark relative h-full w-full overflow-hidden bg-ink-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset"
      style={{ touchAction: 'none' } as object}
      testID="city-walk-stage"
    >
      {params && shouldMountCanvas(state) ? (
        <ThreeCanvas<GameSceneParams>
          key={`attempt-${screen.attempt}`}
          ref={canvas}
          className="absolute inset-0"
          // WebGL 2 on the website (decision record). Chrome's WebGPU rejects the physical post chain's scene pass
          // ("[Texture "output"] ... writable usage and another usage in the same synchronization scope"), the compile
          // never resolves and the load bar stalls at the compile stage; WebGL 2 draws the same scene and runs in
          // every current browser, Safari included.
          forceWebGL
          rendererParams={RENDERER_PARAMS}
          // Same pixel budget as the physical city on the app: a big monitor gets a lower ratio, not a lost context.
          maxPixelRatio={budgetedPixelRatio(windowSize.width, windowSize.height, 2)}
          load={loadGameScene}
          params={params}
          paused
          tracksPointer={false}
          fallback={null}
          background={brand.night}
          onBackendChange={gameScreenActions.backendChanged}
        />
      ) : null}

      <VisuallyHidden aria-live="polite">{state === 'ready' ? COPY.ready : ''}</VisuallyHidden>

      {state === 'loading' ? (
        <View className="absolute inset-0 items-center justify-center bg-ink-950 px-8" testID="city-walk-loading">
          <View className="w-full max-w-[420px] md:max-w-[560px]">
            <ProgressBar
              value={progress}
              district="harlem"
              size="lg"
              showLabel
              label={COPY.loading}
              accessibilityLabel={COPY.loadingA11y}
            />
          </View>
        </View>
      ) : null}

      {blocking ? (
        <View className="absolute inset-0 items-center justify-center bg-surface px-4" testID={`city-walk-${state}`}>
          <EmptyState district="harlem" title={blocking.title} description={blocking.description} action={blocking.action ?? undefined} />
        </View>
      ) : null}


      {worldReady ? (
        <View
          role="group"
          aria-label={COPY.controls.group}
          className="absolute bottom-3 right-3 gap-1 bg-ink-950/60 p-1"
          {...({ 'data-walk-control': 'true' } as object)}
        >
          {PAD.map((row, i) => (
            <View key={i} className="flex-row gap-1">
              {row.map((b) => (
                <IconButton key={b.command} variant="outline" size="md" aria-label={b.label} icon={b.icon} onPress={() => move(b.command)} />
              ))}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
