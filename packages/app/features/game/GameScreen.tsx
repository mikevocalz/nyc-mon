// Game tab: the playable NYC world (PR #29 PR 3, city-renderer scope lock).
// Native only; apps/web never mounts it (PR #29: "Web never gets full Game screen").
//
// Tree:
//   GameScreen (container: measures size + window origin)
//   ├─ GestureDetector → View (world only, accessibility actions)
//   │   └─ ThreeCanvas<GameSceneParams> (paused; draws on demand)
//   └─ HUD overlay (box-none, siblings of the detector)
//       ├─ GameStatusLayer    loading / empty / errors / unsupported
//       ├─ paused scrim       over the world while the session is paused
//       └─ ArcadeController   stick, six caps, START/STOP pill (G01)
//
// Rendering is on demand: the city is static, so ThreeCanvas runs `paused`
// and every camera change calls invalidate() once. No idle frame loop burns
// battery, and reduced motion needs no special case in the renderer.
//
// Gesture ownership (Magiera): the world's pan/pinch/twist detector wraps
// ONLY the canvas. The controller's stick and pill carry their own RNGH
// detectors inside absolutely positioned slots in the sibling overlay, and
// the overlay is `box-none` at every level above a slot, so a touch outside
// a control reaches the world's detector and never a nested handler tree.
//
// Session ownership (Carmack/Acton): `worldSessionStore` owns every
// transition. The pill reflects `pill`; its callbacks ask the session through
// the router (pause, resume, stop) or through `useGameInput` (start, the hold
// beginning and ending). `useWorldSaveLifecycle` is mounted here, once, with
// the Caller identity read the way the boot screen reads it (`readSave()`).
import { useEffect, useMemo, useRef } from 'react';
import { AccessibilityInfo, I18nManager, Platform, type LayoutChangeEvent, type HostInstance } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from 'zustand';
import { IconButton, useInstanceStore, useReducedMotion } from '@acme/ui';
import { ChevronLeft } from '@acme/ui/icons';
import { useGpuSupport } from '@acme/ui/gpu';
import { ThreeCanvas, type ThreeCanvasHandle } from '@acme/ui/three';
import {
  foldLayoutsFromRegions,
  useAdaptiveNavigationPlacement,
  useReservedRegions,
  type FoldLayout,
} from '@acme/ui/adaptive-panes/parts';
import { ArcadeController, useArcadeRiveFiles, type StickAccessibilityAction } from '@acme/ui/game-controls';
import {
  BUTTON_IDS,
  DEFAULT_CAMERA_BINDINGS,
  DEFAULT_CAMERA_SPOKEN_LABELS,
  type ButtonId,
  type ButtonVisualState,
} from '@acme/ui/game-controls/parts';
import { View } from '@acme/ui/tw';
import { brand } from '@acme/theme';
import { GameStatusLayer } from './GameStatusLayer.tsx';
import { commandToAction, describeCamera, type CameraCommand } from './camera-input.ts';
import { isOverMappedArea } from './city-bounds.ts';
import { bundledCity, BUNDLED_CITY_NAME } from './city-data.ts';
import { useControllerLayout } from './controller-layout.store.ts';
import { useControllerProfile } from './controller-profile.store.ts';
import { acceptsGameplayInput, gameplayInputEnabled } from './game-input-bindings.ts';
import { gameCameraStore, gameScreenActions, gameScreenStore } from './game-session.ts';
import { resolveGameViewState, shouldMountCanvas } from './game-status.ts';
import { resolveGameHudLayout } from './hud-layout.ts';
import { loadGameScene, type GameSceneParams } from './load-game-scene.ts';
import { CITY_FRAME_SINK_ENABLED, onCityFrame } from './perf/on-city-frame.ts';
import { useGamePerfMounts } from './perf/use-game-perf.ts';
import { useGameRenderThread } from './render-thread-choice.ts';
import { readLobbyIdentity } from './lobby/lobby-identity.ts';
import { lobbyStore } from './lobby/lobby.store.ts';
import { gameInputRouter, useGameInput } from './use-game-input.ts';
import { livingCityActorFactories, livingCitySky } from './living-city/bundled-host.ts';
import { useCityCameraGestures } from './use-city-camera-gestures.ts';
import { useWorldSaveLifecycle } from './world-resume/use-world-save-lifecycle.ts';
import type { SceneActorFactory } from './scene-actor.ts';
import { createCallerProxy } from './character/caller-proxy.ts';
import { callerStore } from './character/caller-store.ts';
import { CALLER_STEP_ACTIONS, performCallerStep } from './character/caller-runtime.ts';

const A11Y_ACTIONS: readonly { name: CameraCommand; label: string }[] = [
  { name: 'zoomIn', label: 'Zoom in' },
  { name: 'zoomOut', label: 'Zoom out' },
  { name: 'rotateLeft', label: 'Turn view left' },
  { name: 'rotateRight', label: 'Turn view right' },
  { name: 'moveForward', label: 'Move forward' },
  { name: 'moveBack', label: 'Move back' },
  { name: 'moveLeft', label: 'Move left' },
  { name: 'moveRight', label: 'Move right' },
  { name: 'reset', label: 'Reset view' },
];

/** The Caller proxy, until Mike's models land (docs/implementation/caller-proxy.md). Module scope: a stable identity. */
const CALLER_ACTORS: readonly SceneActorFactory[] = [createCallerProxy];

/** The Caller's step actions as the stick's non-drag path (WCAG 2.5.7). */
const STICK_A11Y_ACTIONS: readonly StickAccessibilityAction[] = CALLER_STEP_ACTIONS.map((action) => ({
  name: action.name,
  label: action.label,
  perform: () => {
    performCallerStep(action.name);
  },
}));

/** Every cap disabled: the session is not playing, so a press would do nothing (no dead buttons). */
const ALL_CAPS_DISABLED: Partial<Record<ButtonId, Extract<ButtonVisualState, 'disabled'>>> = Object.fromEntries(
  BUTTON_IDS.map((id) => [id, 'disabled' as const]),
);

interface Geometry { width: number; height: number; originX: number; originY: number }

/** Props of {@linkcode GameScreen}. */
export interface GameScreenProps {
  /** Whether the Game route has navigation focus; losing it drops every held input. @default true */
  readonly focused?: boolean;
}

export function GameScreen({ focused = true }: GameScreenProps = {}) {
  const arcadeRive = useArcadeRiveFiles();
  const city = bundledCity();
  const gpu = useGpuSupport();
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const placement = useAdaptiveNavigationPlacement();
  const regions = useReservedRegions();
  const profile = useControllerProfile((s) => s.profile);
  const savedLayouts = useControllerLayout((s) => s.layouts);

  // Live container geometry: per-instance store, never a launch-time Dimensions read.
  const geometry = useInstanceStore<Geometry>(() => ({ width: 0, height: 0, originX: 0, originY: 0 }));
  const { width, height, originX, originY } = useStore(geometry);
  const host = useRef<HostInstance>(null);
  const canvas = useRef<ThreeCanvasHandle>(null);

  const screen = useStore(gameScreenStore);
  const overMappedArea = useStore(gameCameraStore, (s) => (city.ok ? isOverMappedArea(s.camera, city.bounds) : true));
  const state = resolveGameViewState({
    dataset: city.ok ? 'ok' : 'error',
    gpu,
    canvasFailed: screen.canvasFailed,
    firstFrame: screen.firstFrame,
    overMappedArea,
  });
  const worldReady = state === 'ready' || state === 'empty';
  // The lobby's START waits on this (review finding C1): a state that can never draw fails the start.
  useEffect(() => {
    gameScreenActions.viewStateChanged(state);
  }, [state]);
  useEffect(() => () => gameScreenActions.viewStateChanged(null), []);
  // Gameplay input and the controller exist only once the lobby has handed over (review finding H1):
  // under the cover, neither touch, hardware nor a screen reader reaches the world.
  const lobbyPhase = useStore(lobbyStore, (s) => s.phase);
  const handedOver = gameplayInputEnabled(true, lobbyPhase);

  // Camera -> one redraw, outside React render (no per-event re-render of ThreeCanvas).
  useEffect(() => gameCameraStore.subscribe(() => canvas.current?.invalidate()), []);
  // The Caller moving (a jump in place moves no camera) -> one redraw, outside React render.
  useEffect(() => callerStore.subscribe(() => canvas.current?.invalidate()), []);

  // Redraw once when the lobby hands over. The on-demand canvas drew its
  // first frame under the lobby cover, and on Android that frame does not
  // survive the cover's removal (seen on Surface Duo, 2026-10-15: dark canvas
  // until the first camera move). The camera is already restored, so this
  // frame is still the resumed view.
  // The redraw waits two animation frames: `game` and the cover's `done` land
  // in the same commit, so a redraw in this effect still ran under the cover
  // and the loader lifted onto a dark canvas (Surface Duo, 2026-10-16). By the
  // second frame the native cover view is gone.
  useEffect(() => {
    if (lobbyPhase !== 'game') return;
    let second = 0;
    const first = requestAnimationFrame(() => {
      canvas.current?.invalidate();
      second = requestAnimationFrame(() => canvas.current?.invalidate());
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [lobbyPhase]);

  // "Success": one polite announcement when the world first appears this session.
  useEffect(() => {
    if (state !== 'ready' || screen.announcedReady) return;
    AccessibilityInfo.announceForAccessibility(`${BUNDLED_CITY_NAME} map ready. ${describeCamera(gameCameraStore.getState().camera)}`);
    gameScreenActions.markAnnounced();
  }, [state, screen.announcedReady]);

  // Stable params; the getter reads the latest camera at draw time.
  // createCityScene throws if `dataset` identity changes, and it never does here.
  const params = useMemo<GameSceneParams | null>(() => {
    if (!city.ok) return null;
    return {
      dataset: city.dataset,
      get camera() { return gameCameraStore.getState().camera; },
      // PR05/PR06 Living City (EXPO_PUBLIC_LIVING_CITY=1, default off): the
      // flag contributes the vehicle + pedestrian factories; off, the list is
      // byte-identical.
      actors: [...CALLER_ACTORS, ...livingCityActorFactories()],
      // PR07: the world clock picks the sky preset (dusk at the slice's
      // starting hour). Flag off → undefined → the world's own default.
      sky: livingCitySky(),
      onFirstFrame: gameScreenActions.firstFrame,
    };
  }, [city]);

  // Off by default; EXPO_PUBLIC_WORKLET_RENDER=1 renders on a worklet runtime (docs/implementation/worklet-rendering.md).
  const renderThread = useGameRenderThread();

  const gestures = useCityCameraGestures({
    viewportHeight: () => geometry.getState().height,
    reducedMotion,
    enabled: worldReady,
  });

  const onLayout = (event: LayoutChangeEvent) => {
    const { width: w, height: h } = event.nativeEvent.layout;
    // Window origin converts fold geometry (window space) to container space on BOTH axes.
    host.current?.measureInWindow((x, y) => geometry.setState({ width: w, height: h, originX: x, originY: y }));
  };

  // Folds in container coordinates. foldLayoutsFromRegions converts x only, so subtract y here.
  const folds: FoldLayout[] = foldLayoutsFromRegions(regions, originX).map((f) => ({ ...f, y: f.y - originY }));
  const railEdge = placement.rail && placement.position !== 'bottom' ? placement.position : null;
  // The tab layout already pads for the bar/rail; the top inset is the screen's to clear.
  const hudInsets = { top: insets.top, bottom: placement.rail ? insets.bottom : 0, left: insets.left, right: railEdge === 'right' ? 0 : insets.right };
  const hud = resolveGameHudLayout({ width, height, insets: hudInsets, folds, railEdge, isRTL: I18nManager.isRTL });

  // The session and its save cadence, mounted once per Game screen.
  const identity = useMemo(() => readLobbyIdentity(), []);
  const dataset = city.ok ? city.dataset : null;
  useWorldSaveLifecycle({ identity, dataset });
  // Flag-gated platform perf mounts: display-rate vote, thermal headroom
  // monitor, ADPF hint session (performance-pass PR4.2 / PR5.1-2). Only while
  // the Game tab is focused: the tab stays mounted when the player leaves it.
  useGamePerfMounts(worldReady && focused);
  const input = useGameInput({
    enabled: gameplayInputEnabled(worldReady, lobbyPhase),
    focused,
    viewportHeight: () => geometry.getState().height,
    identity,
    dataset,
    profile,
    foldSignature: JSON.stringify(folds.filter((f) => f.separating || f.occlusionType === 'full').map((f) => [f.orientation, f.x, f.y, f.width, f.height])),
    layoutSignature: `${width}x${height}`,
    reducedMotion,
  });
  const playing = acceptsGameplayInput(input.session);

  const onAccessibilityAction = (event: { nativeEvent: { actionName: string } }) => {
    const command = A11Y_ACTIONS.find((a) => a.name === event.nativeEvent.actionName)?.name;
    if (!command) return;
    const { camera, move } = gameCameraStore.getState();
    move(commandToAction(command, camera));
    AccessibilityInfo.announceForAccessibility(describeCamera(gameCameraStore.getState().camera));
  };

  return (
    <View
      ref={host as never}
      className="flex-1 bg-surface"
      onLayout={onLayout}
      accessibilityElementsHidden={!handedOver}
      importantForAccessibility={handedOver ? 'auto' : 'no-hide-descendants'}
    >
      {params && shouldMountCanvas(state) && renderThread.settled ? (
        <GestureDetector gesture={gestures}>
          <View
            className="flex-1"
            accessible
            aria-label={`3D map of ${BUNDLED_CITY_NAME}`}
            accessibilityHint="Drag to move, pinch to zoom, twist to turn. Swipe up or down for camera actions."
            accessibilityActions={A11Y_ACTIONS as never}
            onAccessibilityAction={onAccessibilityAction}
            // Double-tap-with-two-fingers (iOS magic tap) resets the view.
            onMagicTap={() => gameCameraStore.getState().move({ type: 'reset' })}
          >
            <ThreeCanvas<GameSceneParams>
              // Keyed on Retry only, never on size, posture or fold: resizing keeps the renderer and camera.
              key={`attempt-${screen.attempt}`}
              ref={canvas}
              renderThread={renderThread.thread}
              workletHost={renderThread.host}
              load={loadGameScene}
              params={params}
              paused
              // RN pointer handlers would sit inside the RNGH detector; the camera has its own gestures.
              tracksPointer={false}
              // Not the error UI: ThreeCanvas renders fallback inside a pointer-events-none
              // layer, so buttons there could not be pressed. The status layer draws errors.
              fallback={null}
              background={brand.night}
              // No accessibilityLabel: the canvas layer stays hidden; the wrapping View is the named, actionable element.
              onBackendChange={gameScreenActions.backendChanged}
              onFrameTiming={CITY_FRAME_SINK_ENABLED ? onCityFrame : undefined}
            />
          </View>
        </GestureDetector>
      ) : null}

      <View className="absolute inset-0" pointerEvents="box-none">
        <GameStatusLayer state={state} rect={hud.status} region={hud.blocking} />
        {worldReady && input.session.kind === 'paused' ? (
          // The paused world under the scene scrim (G01 08-handoff.md § States); the controls stay above it.
          <View className="absolute inset-0 bg-scrim-scene" pointerEvents="none" {...({ testID: 'g01-scrim' } as object)} />
        ) : null}
        {worldReady && handedOver ? (
          <ArcadeController
            rive={arcadeRive}
            testID="g01-controller"
            profile={profile}
            bindings={DEFAULT_CAMERA_BINDINGS}
            spokenLabels={DEFAULT_CAMERA_SPOKEN_LABELS}
            router={gameInputRouter}
            pill={input.pill}
            stopProgress={input.stopProgress}
            reducedMotion={reducedMotion}
            savedLayouts={savedLayouts}
            insets={hudInsets}
            hideTouchControls={input.hideTouchControls}
            // An idle session with no Caller cannot start: the pill says so instead of a tap that does nothing.
            disabled={input.session.kind === 'idle' && identity === null}
            // Caps act only while playing; disabled otherwise so a press never lands on nothing.
            buttonOverrides={playing ? undefined : ALL_CAPS_DISABLED}
            stickA11yActions={STICK_A11Y_ACTIONS}
            onStart={input.startSession}
            onStopHoldStart={input.beginStopConfirm}
            onStopReleased={input.cancelStopConfirm}
          />
        ) : null}
        {handedOver ? (
          // Leave the city: pause (the session saves on pause), then back to
          // the lobby, which offers "Continue your game". The rail is hidden
          // while the city is up, so this is the way out.
          <View className="absolute" style={{ top: insets.top + 12, left: insets.left + 12 }}>
            <IconButton
              aria-label="Back to the lobby"
              icon={<ChevronLeft />}
              variant="cornerCut"
              tone="orange"
              corner="bottom-right"
              size="lg"
              onPress={() => {
                gameInputRouter.pauseRequest('touch');
                lobbyStore.getState().returnToLobby();
              }}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

// Platform guard: the shell must not route web here (PR #29). Fails loudly in dev if it does.
if (__DEV__ && Platform.OS === 'web') console.error('[GameScreen] mounted on web; the Game tab is native only.');
