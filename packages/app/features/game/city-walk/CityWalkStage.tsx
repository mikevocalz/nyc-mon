'use client';
// The website's city walk: the Game world (load-game-scene.ts, the same scene, cell release and storefront plan the
// app draws) with a guest camera. Web only; the native Game tab stays GameScreen (decision record:
// docs/implementation/city-walk-web.md).
//
// What is shared with GameScreen: ThreeCanvas, loadGameScene, the view states (resolveGameViewState) and the staged
// load bar (gameScreenStore.loadProgress). What is not: the lobby, the Caller, the session and its save, the arcade
// controller — and the camera store. The walk keeps its own (walkCameraStore below): a guest has no Caller, and the
// walk's pan rect is the whole streamed city (walk-destinations.ts walkCameraBounds), not the bundled tile's
// +/-2000 m the Game clamps to.
//
// Input: keyboard (walk-keys.ts) while the stage has focus, pointer drag/pinch/twist plus tap-to-move
// (walk-pointer.ts, walk-view.ts), the wheel, hold-to-move pad buttons and a Go to list of the bake's named
// landmarks (walk-destinations.ts). All of it ends in the walk store's move, and every camera change asks the
// paused canvas for one redraw, so an idle city draws nothing.
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useWindowDimensions } from 'react-native';
import { useStore } from 'zustand';
import { Button, EmptyState, IconButton, Select, useReducedMotion } from '@acme/ui';
import { useGpuSupport, type GpuSupport } from '@acme/ui/gpu';
import { ChevronDown, ChevronLeft, ChevronRight, Compass, Minus, Plus, Redo2, Undo2 } from '@acme/ui/icons';
import { ProgressBar } from '@acme/ui/progress';
import { ThreeCanvas, type ThreeCanvasHandle } from '@acme/ui/three';
import { Text, VisuallyHidden } from '@acme/ui/html';
import { View } from '@acme/ui/tw';
import { brand } from '@acme/theme';
import { commandToAction, headingPoint, type CameraCommand } from '../camera-input.ts';
import { bundledCity } from '../city-data.ts';
import { createCityCameraStore } from '../city-camera.ts';
import { gameScreenActions, gameScreenStore } from '../game-session.ts';
import { resolveGameViewState, shouldMountCanvas } from '../game-status.ts';
import { livingCityActorFactories, livingCitySky } from '../living-city/bundled-host.ts';
import { loadGameScene, type GameSceneParams } from '../load-game-scene.ts';
import { budgetedPixelRatio } from '../perf/pixel-budget.ts';
import { physicalRendererParams } from '../world/physical-look.ts';
import { onTimeOfDayChange, timeOfDayStore } from '../world/time-of-day.store.ts';
import { vdStorefrontPlan } from '../world/vd-port/storefronts/load.ts';
import { CITY_WALK_COPY as COPY } from './copy.ts';
import { actionsForFrame, intentForKey, wheelToAction, type WalkIntent } from './walk-keys.ts';
import { pointerActions, type PointerPoint } from './walk-pointer.ts';
import { cameraBasis, groundPointForScreen, isTap, startTravel, stepTravel, type WalkTravel } from './walk-view.ts';
import {
  landmarkLabels,
  nearestDestination,
  pickOverlayLabels,
  signLabels,
  walkCameraBounds,
  walkDestinations,
  type WalkLabel,
} from './walk-destinations.ts';
import { createStreetLabelSource, type StreetLabelSource } from './walk-street.ts';

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

/**
 * The walk's camera, module scope like the game's (leaving and revisiting the page keeps where the guest was
 * looking). Its bounds come from the mapped cells and landmarks, so the far boroughs are reachable on purpose.
 */
let store: ReturnType<typeof createCityCameraStore> | null = null;
function walkCameraStore() {
  if (!store) {
    const city = bundledCity();
    store = createCityCameraStore(city.ok ? walkCameraBounds(city.dataset.origin) : undefined);
  }
  return store;
}

const move = (command: CameraCommand) => {
  const { camera, move: apply } = walkCameraStore().getState();
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

/** The held intent a pad button drives while pressed (reset fires once on press, so it is not here). */
const PAD_HOLD: Partial<Record<CameraCommand, WalkIntent>> = {
  moveForward: 'forward',
  moveBack: 'back',
  moveLeft: 'left',
  moveRight: 'right',
  rotateLeft: 'turnLeft',
  rotateRight: 'turnRight',
  zoomIn: 'zoomIn',
  zoomOut: 'zoomOut',
};

/** Input bookkeeping: refs, not React state (repo rule), so a held key or a moving finger never re-renders. */
interface InputRefs {
  held: Set<WalkIntent>;
  /** Pad buttons currently held, pointerId -> intent (released by a window-level pointerup/cancel). */
  padHeld: Map<number, WalkIntent>;
  /** The eased glide a tap or pick started, or null. */
  travel: WalkTravel | null;
  /** The press a possible tap started from. */
  down: { id: number; x: number; y: number; at: number; multi: boolean } | null;
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
  const reducedMotion = useReducedMotion();
  const canvas = useRef<ThreeCanvasHandle>(null);
  const stage = useRef<unknown>(null);
  const overlay = useRef<HTMLElement | null>(null);
  const input = useRef<InputRefs>({ held: new Set(), padHeld: new Map(), travel: null, down: null, frame: 0, last: 0, pointers: new Map() });
  // The overlay's label supply: landmarks and plan signs computed once, street names arriving per cell.
  const [signs, setSigns] = useState<readonly WalkLabel[]>([]);
  const [streetLabels, setStreetLabels] = useState<readonly WalkLabel[]>([]);
  const streets = useRef<StreetLabelSource | null>(null);
  const streetList = useRef<WalkLabel[]>([]);
  const streetCell = useRef<[number, number]>([Infinity, Infinity]);
  const streetsPushed = useRef(new Set<string>());
  const labelGroups = useRef<{ landmarks: readonly WalkLabel[]; signs: readonly WalkLabel[]; streets: readonly WalkLabel[] }>({ landmarks: [], signs: [], streets: [] });
  const [status, setStatus] = useState('');
  const [arrived, setArrived] = useState('');
  const [picked, setPicked] = useState('start');

  const screen = useStore(gameScreenStore);
  const progress = screen.loadProgress;
  const state = resolveGameViewState({
    dataset: city.ok ? 'ok' : 'error',
    gpu: walkGpuSupport(webgpu, gl2),
    canvasFailed: screen.canvasFailed,
    firstFrame: screen.firstFrame,
    // Not the bundled tile's bounds (city-bounds.ts): the walk draws Valdrada's streamed rings and far tier, which
    // cover every point the camera can reach, so "nothing mapped here" would be false.
    overMappedArea: true,
  });
  const worldReady = state === 'ready' || state === 'empty';

  const destinations = useMemo(() => (city.ok ? walkDestinations(city.dataset.origin) : []), [city]);
  const landmarks = useMemo(() => (city.ok ? landmarkLabels(city.dataset.origin) : []), [city]);
  const allLabels = useMemo(() => [...landmarks, ...signs, ...streetLabels], [landmarks, signs, streetLabels]);
  const goToOptions = useMemo(() => destinations.map((d) => ({ value: d.key, label: d.name })), [destinations]);

  // A fresh mount has drawn nothing: a first frame from an earlier visit must not count.
  useEffect(() => {
    gameScreenActions.resetForMount();
  }, []);
  useEffect(() => onTimeOfDayChange(timeOfDayStore, () => canvas.current?.invalidate()), []);

  const params = useMemo<GameSceneParams | null>(() => {
    if (!city.ok) return null;
    return {
      dataset: city.dataset,
      get camera() { return walkCameraStore().getState().camera; },
      // No Caller on the website: the guest walk has no session to drive one.
      actors: [...livingCityActorFactories()],
      sky: livingCitySky(),
      get preset() { return timeOfDayStore.getState().preset; },
      onFirstFrame: gameScreenActions.firstFrame,
    };
  }, [city]);

  /** Writes each in-range label's screen position straight onto its node; off-screen or out-of-range labels hide. */
  const layoutLabels = useCallback(() => {
    const root = overlay.current;
    if (!root) return;
    const rect = root.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const placed = pickOverlayLabels(walkCameraStore().getState().camera, { width: rect.width, height: rect.height }, labelGroups.current);
    const byKey = new Map(placed.map((p) => [p.key, p]));
    for (const el of root.querySelectorAll<HTMLElement>('[data-label-key]')) {
      const p = byKey.get(el.getAttribute('data-label-key') ?? '');
      if (!p) {
        if (el.style.display !== 'none') el.style.display = 'none';
        continue;
      }
      if (el.style.display === 'none') el.style.display = '';
      el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)${p.angle !== undefined ? ` rotate(${p.angle.toFixed(1)}deg)` : ''} translate(-50%, -50%)`;
    }
  }, []);

  /** The "you are here" line: the street underfoot, else the nearest landmark, else the compass point. */
  const updateStatus = useCallback(() => {
    const { camera } = walkCameraStore().getState();
    const street = streets.current?.nearest(camera.x, camera.z) ?? null;
    let text: string;
    if (street && street.meters <= 60) {
      text = street.label.name;
    } else {
      const near = nearestDestination(camera.x, camera.z, destinations);
      text = near && near.meters <= 600 ? COPY.status.near(near.destination.name) : COPY.status.facing(headingPoint(camera));
    }
    setStatus((prev) => (prev === text ? prev : text));
  }, [destinations]);

  /** Fetches the 3x3 block of street-label cells around the look-at (each once; the source dedupes). */
  const ensureStreetCells = useCallback(() => {
    const source = streets.current;
    if (!source) return;
    const { camera } = walkCameraStore().getState();
    const [cx, cz] = source.cellOf(camera.x, camera.z);
    if (streetCell.current[0] === cx && streetCell.current[1] === cz) return;
    streetCell.current = [cx, cz];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const key = `${cx + dx}_${cz + dz}`;
        void source.ensure(cx + dx, cz + dz).then((labels) => {
          if (labels.length === 0 || streetsPushed.current.has(key)) return;
          streetsPushed.current.add(key);
          for (const l of labels) {
            streetList.current.push({ key: `st:${key}:${l.segId}`, text: l.name, kind: 'street', x: l.x, y: l.y + 2, z: l.z, angle: l.angle });
          }
          setStreetLabels([...streetList.current]);
        });
      }
    }
  }, []);

  // Every camera step redraws the canvas, re-places the labels, refreshes the status line and pulls the street
  // cells the look-at moved into. One subscription for all of it.
  useEffect(() => {
    const onCamera = () => {
      canvas.current?.invalidate();
      layoutLabels();
      updateStatus();
      ensureStreetCells();
    };
    const unsubscribe = walkCameraStore().subscribe(onCamera);
    onCamera();
    return unsubscribe;
  }, [layoutLabels, updateStatus, ensureStreetCells]);

  // The overlay's label supply (kept in a ref so the per-move layout never touches React state).
  useEffect(() => {
    labelGroups.current = { landmarks, signs, streets: streetLabels };
    layoutLabels();
  }, [landmarks, signs, streetLabels, layoutLabels]);
  // A resize moves every projected point.
  useEffect(() => {
    layoutLabels();
  }, [windowSize.width, windowSize.height, layoutLabels]);

  // Once the world is up: the storefront plan's recorded signs join the overlay, and the street-label source
  // starts serving cells (the packs are bundled assets; a missing one just decodes to an empty cell).
  useEffect(() => {
    if (!worldReady || !city.ok) return;
    let alive = true;
    void Promise.all([
      import('../world/vd-port/systems/data/assets.ts'),
      import('@acme/ui/three/asset-bytes'),
      Promise.resolve(vdStorefrontPlan()),
    ]).then(([{ VD_SYSTEM_ASSETS }, { fetchAssetBytes }, plan]) => {
      if (!alive) return;
      setSigns(signLabels(plan));
      if (streets.current) return;
      streets.current = createStreetLabelSource(async (key) => {
        const id = VD_SYSTEM_ASSETS.labels?.[key];
        return id === undefined ? null : fetchAssetBytes(id);
      });
      ensureStreetCells();
    });
    return () => {
      alive = false;
    };
  }, [worldReady, city, ensureStreetCells]);

  // Keyboard, pointer and wheel, on the stage element itself: the page keeps its own keys and scroll elsewhere.
  useEffect(() => {
    const el = stage.current as HTMLElement | null;
    if (!el || !worldReady) return;
    const refs = input.current;
    const cameraStore = walkCameraStore();
    const viewportHeight = () => el.getBoundingClientRect().height;

    const active = () => refs.held.size > 0 || refs.padHeld.size > 0 || refs.travel !== null;
    const tick = (now: number) => {
      const dt = refs.last ? (now - refs.last) / 1000 : 0;
      refs.last = now;
      const { camera, move: apply } = cameraStore.getState();
      const intents = refs.padHeld.size === 0 ? refs.held : new Set([...refs.held, ...refs.padHeld.values()]);
      // Any held control cancels a glide; the hands-on input wins.
      if (intents.size > 0) refs.travel = null;
      for (const action of actionsForFrame(intents, camera, dt)) apply(action);
      if (refs.travel) {
        const next = stepTravel(refs.travel, dt);
        apply({ type: 'travel', x: next.x, z: next.z });
        if (next.done) refs.travel = null;
      }
      refs.frame = active() ? requestAnimationFrame(tick) : 0;
      if (!refs.frame) refs.last = 0;
    };
    const startTick = () => {
      if (!refs.frame) {
        refs.last = 0;
        refs.frame = requestAnimationFrame(tick);
      }
    };
    const stopInput = () => {
      refs.held.clear();
      refs.padHeld.clear();
      refs.travel = null;
      refs.down = null;
      if (refs.frame) cancelAnimationFrame(refs.frame);
      refs.frame = 0;
      refs.last = 0;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const intent = intentForKey(event.code);
      if (intent === null) return;
      event.preventDefault();
      refs.travel = null;
      if (intent === 'reset') {
        if (!event.repeat) move('reset');
        return;
      }
      refs.held.add(intent);
      startTick();
    };
    const onKeyUp = (event: KeyboardEvent) => {
      const intent = intentForKey(event.code);
      if (intent !== null && intent !== 'reset') refs.held.delete(intent);
    };

    const ordered = () => [...refs.pointers.values()];
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      const target = event.target as Element | null;
      // Pad buttons drive their held intent from the press itself; a tap still lands the button's click step.
      const command = target?.closest?.('[data-walk-command]')?.getAttribute('data-walk-command') as CameraCommand | null | undefined;
      if (command) {
        const intent = PAD_HOLD[command];
        if (intent) {
          refs.travel = null;
          refs.padHeld.set(event.pointerId, intent);
          startTick();
        }
        return;
      }
      // Other controls on the stage (the Go to list) handle their own presses.
      if (target?.closest?.('[data-walk-control]')) return;
      refs.travel = null;
      if (refs.pointers.size > 0 && refs.down) refs.down.multi = true;
      refs.down = { id: event.pointerId, x: event.clientX, y: event.clientY, at: event.timeStamp, multi: refs.pointers.size > 0 };
      el.setPointerCapture?.(event.pointerId);
      refs.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!refs.pointers.has(event.pointerId)) return;
      const before = ordered();
      refs.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const { camera, move: apply } = cameraStore.getState();
      for (const action of pointerActions(before, ordered(), camera, viewportHeight())) apply(action);
    };
    const onPointerEnd = (event: PointerEvent) => {
      refs.pointers.delete(event.pointerId);
      // A press that barely moved and did not last is a tap: walk to the ground point under it.
      const down = refs.down;
      if (!down || down.id !== event.pointerId) return;
      refs.down = null;
      if (down.multi || !isTap(down, { x: event.clientX, y: event.clientY, at: event.timeStamp })) return;
      const rect = el.getBoundingClientRect();
      const basis = cameraBasis(cameraStore.getState().camera);
      const hit =
        basis &&
        groundPointForScreen(basis, event.clientX - rect.left, event.clientY - rect.top, { width: rect.width, height: rect.height });
      if (!hit) return;
      refs.travel = startTravel(cameraStore.getState().camera, hit.x, hit.z, reducedMotion);
      if (refs.travel) startTick();
    };
    // Pad holds release wherever the pointer ends, including off the stage (no capture is taken on controls).
    const onAnyPointerEnd = (event: PointerEvent) => {
      refs.padHeld.delete(event.pointerId);
    };
    const onWheel = (event: WheelEvent) => {
      const action = wheelToAction(event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY);
      if (!action) return;
      event.preventDefault();
      refs.travel = null;
      cameraStore.getState().move(action);
    };

    el.addEventListener('keydown', onKeyDown);
    el.addEventListener('keyup', onKeyUp);
    el.addEventListener('blur', stopInput);
    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerEnd);
    el.addEventListener('pointercancel', onPointerEnd);
    el.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('pointerup', onAnyPointerEnd);
    window.addEventListener('pointercancel', onAnyPointerEnd);
    return () => {
      stopInput();
      refs.pointers.clear();
      el.removeEventListener('keydown', onKeyDown);
      el.removeEventListener('keyup', onKeyUp);
      el.removeEventListener('blur', stopInput);
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerEnd);
      el.removeEventListener('pointercancel', onPointerEnd);
      el.removeEventListener('wheel', onWheel);
      window.removeEventListener('pointerup', onAnyPointerEnd);
      window.removeEventListener('pointercancel', onAnyPointerEnd);
    };
  }, [worldReady, reducedMotion]);

  const blocking =
    state === 'unsupported' ? { ...COPY.unsupported, action: null }
    : state === 'data-error' ? { ...COPY.dataError, action: null }
    : state === 'render-error'
      ? { ...COPY.renderError, action: <Button district="harlem" title={COPY.renderError.action} onPress={gameScreenActions.retry} /> }
      : null;

  const goTo = (key: string) => {
    const d = destinations.find((dest) => dest.key === key);
    if (!d) return;
    setPicked(key);
    input.current.travel = null;
    // 'start' is the full reset (yaw included); anywhere else lands over the place at its framing distance.
    walkCameraStore().getState().move(d.key === 'start' ? { type: 'reset' } : { type: 'travel', x: d.x, z: d.z, distance: d.distance });
    setArrived(COPY.goTo.arrived(d.name));
  };

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
      <VisuallyHidden aria-live="polite">{arrived}</VisuallyHidden>
      <VisuallyHidden>{COPY.stageHint}</VisuallyHidden>

      {worldReady ? (
        // The world-anchored names: landmarks, recorded storefront signs and CSCL street names, positioned from the
        // live camera every move. Decorative — the Go to list is the accessible path to the same places.
        <View
          ref={overlay as never}
          aria-hidden={true}
          className="pointer-events-none absolute inset-0 overflow-hidden"
          testID="city-walk-labels"
        >
          {allLabels.map((l) => (
            <Text
              key={l.key}
              {...({ 'data-label-key': l.key } as object)}
              className={`absolute left-0 top-0 hidden whitespace-nowrap rounded-sm px-1 font-medium ${
                l.kind === 'landmark' ? 'text-[11px] text-text' : 'text-[10px] text-text-secondary'
              }`}
              style={{ backgroundColor: 'rgba(6, 11, 20, 0.55)' } as object}
            >
              {l.text}
            </Text>
          ))}
        </View>
      ) : null}

      {worldReady && status ? (
        <View className="pointer-events-none absolute left-3 top-3 bg-ink-950/60 px-2 py-1" testID="city-walk-status">
          <Text className="text-xs text-text">{status}</Text>
        </View>
      ) : null}

      {worldReady && goToOptions.length > 0 ? (
        <View className="absolute right-3 top-3 w-52" {...({ 'data-walk-control': 'true' } as object)} testID="city-walk-goto">
          <Select
            label={COPY.goTo.label}
            hint={COPY.goTo.hint}
            options={goToOptions}
            value={picked}
            onValueChange={goTo}
            district="harlem"
          />
        </View>
      ) : null}

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
                <IconButton
                  key={b.command}
                  variant="outline"
                  size="md"
                  aria-label={b.label}
                  icon={b.icon}
                  onPress={() => move(b.command)}
                  {...({ 'data-walk-command': b.command } as object)}
                />
              ))}
            </View>
          ))}
          <Text className="px-1 pt-0.5 text-[10px] text-text-secondary">{COPY.controls.padHint}</Text>
        </View>
      ) : null}
    </View>
  );
}
