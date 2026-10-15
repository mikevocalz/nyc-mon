// Game tab: the playable NYC world (PR #29 PR 3, city-renderer scope lock).
// Native only; apps/web never mounts it (PR #29: "Web never gets full Game screen").
//
// Tree:
//   GameScreen (container: measures size + window origin)
//   ├─ GestureDetector → View (world only, accessibility actions)
//   │   └─ ThreeCanvas<GameSceneParams> (paused; draws on demand)
//   └─ HUD overlay (box-none, siblings of the detector)
//       ├─ GameStatusLayer   loading / empty / errors / unsupported
//       ├─ CameraControls    + move pad
//       └─ MapAttribution    ODbL, always while the dataset exists
//
// Rendering is on demand: the city is static, so ThreeCanvas runs `paused`
// and every camera change calls invalidate() once. No idle frame loop burns
// battery, and reduced motion needs no special case in the renderer.
import { useEffect, useMemo, useRef } from 'react';
import { AccessibilityInfo, I18nManager, Platform, type LayoutChangeEvent, type HostInstance } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from 'zustand';
import { useInstanceStore, useReducedMotion } from '@acme/ui';
import { useGpuSupport } from '@acme/ui/gpu';
import { ThreeCanvas, type ThreeCanvasHandle } from '@acme/ui/three';
import {
  foldLayoutsFromRegions,
  useAdaptiveNavigationPlacement,
  useReservedRegions,
  type FoldLayout,
} from '@acme/ui/adaptive-panes/parts';
import { View } from '@acme/ui/tw';
import { brand } from '@acme/theme';
import { CameraControls } from './CameraControls.tsx';
import { GameStatusLayer } from './GameStatusLayer.tsx';
import { MapAttribution } from './MapAttribution.tsx';
import { commandToAction, describeCamera, type CameraCommand } from './camera-input.ts';
import { isOverMappedArea } from './city-bounds.ts';
import { bundledCity, BUNDLED_CITY_NAME } from './city-data.ts';
import { gameCameraStore, gameScreenActions, gameScreenStore } from './game-session.ts';
import { resolveGameViewState, shouldMountCanvas } from './game-status.ts';
import { resolveGameHudLayout } from './hud-layout.ts';
import { loadGameScene, type GameSceneParams } from './load-game-scene.ts';
import { useCityCameraGestures } from './use-city-camera-gestures.ts';

const CONTROL_COUNT = 6;

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

interface Geometry { width: number; height: number; originX: number; originY: number }

export function GameScreen() {
  const city = bundledCity();
  const gpu = useGpuSupport();
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const placement = useAdaptiveNavigationPlacement();
  const regions = useReservedRegions();

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

  // Camera -> one redraw, outside React render (no per-event re-render of ThreeCanvas).
  useEffect(() => gameCameraStore.subscribe(() => canvas.current?.invalidate()), []);

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
      onFirstFrame: gameScreenActions.firstFrame,
    };
  }, [city]);

  const gestures = useCityCameraGestures({
    viewportHeight: () => geometry.getState().height,
    reducedMotion,
    enabled: state === 'ready' || state === 'empty',
  });

  const onLayout = (event: LayoutChangeEvent) => {
    const { width: w, height: h } = event.nativeEvent.layout;
    // Window origin converts fold geometry (window space) to container space on BOTH axes.
    host.current?.measureInWindow((x, y) => geometry.setState({ width: w, height: h, originX: x, originY: y }));
  };

  // Folds in container coordinates. foldLayoutsFromRegions converts x only, so subtract y here.
  const folds: FoldLayout[] = foldLayoutsFromRegions(regions, originX).map((f) => ({ ...f, y: f.y - originY }));
  const railEdge = placement.rail && placement.position !== 'bottom' ? placement.position : null;
  const hud = resolveGameHudLayout({
    width,
    height,
    // The tab layout already pads for the bar/rail; the top inset is the screen's to clear.
    insets: { top: insets.top, bottom: placement.rail ? insets.bottom : 0, left: insets.left, right: railEdge === 'right' ? 0 : insets.right },
    folds,
    railEdge,
    isRTL: I18nManager.isRTL,
    controlCount: CONTROL_COUNT,
    movePadOpen: screen.movePadOpen,
  });

  const onAccessibilityAction = (event: { nativeEvent: { actionName: string } }) => {
    const command = A11Y_ACTIONS.find((a) => a.name === event.nativeEvent.actionName)?.name;
    if (!command) return;
    const { camera, move } = gameCameraStore.getState();
    move(commandToAction(command, camera));
    AccessibilityInfo.announceForAccessibility(describeCamera(gameCameraStore.getState().camera));
  };

  return (
    <View ref={host as never} className="flex-1 bg-surface" onLayout={onLayout}>
      {params && shouldMountCanvas(state) ? (
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
            />
          </View>
        </GestureDetector>
      ) : null}

      <View className="absolute inset-0" pointerEvents="box-none">
        <GameStatusLayer state={state} rect={hud.status} region={hud.blocking} />
        {state === 'ready' || state === 'empty' ? <CameraControls layout={hud} /> : null}
        {city.ok && shouldMountCanvas(state) ? <MapAttribution source={city.dataset.source} rect={hud.attribution} /> : null}
      </View>
    </View>
  );
}

// Platform guard: the shell must not route web here (PR #29). Fails loudly in dev if it does.
if (__DEV__ && Platform.OS === 'web') console.error('[GameScreen] mounted on web; the Game tab is native only.');
