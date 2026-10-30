'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { palette, semantic } from '@acme/theme';
import { needsViroRewrite, viroReadableGlb } from './glbDequantize';
import { readModelPoints, type ModelPoints } from './modelBounds';
import { fallbackExtent, previewCamera, turnExtent, type TurnExtent } from './modelFraming';
import { dragTurn, keyTurn, type Turn } from './modelTurn';
import { View } from '@acme/ui/tw';
import {
  Viro3DObject,
  Viro3DSceneNavigator,
  ViroAmbientLight,
  ViroDirectionalLight,
  ViroOrbitCamera,
  ViroScene,
} from './viro';

type Vec3 = [number, number, number];

export type MonModelViewerProps = {
  /** GLB URL: the Bunny CDN copy, or a blob: URL for a file not saved yet. */
  url: string;
  scale: number;
  position: Vec3;
  rotation: Vec3;
  /** Extra turn on Y for looking around the model, in degrees. */
  yaw?: number;
  /** Camera tilt above (positive) or below the model's middle, in degrees. */
  pitch?: number;
  /** Called with the next yaw and pitch while the stage is dragged or arrow keys are pressed. */
  onTurn?: (turn: Turn) => void;
  /** Called on a double-click: back to the front, level. */
  onResetTurn?: () => void;
  /** Accessible name for the stage, which takes focus so arrow keys turn the model. */
  turnLabel?: string;
  /** Height recorded at upload (glb.ts); frames the model when its vertices cannot be read. */
  heightMeters?: number | null;
  /** Clip to loop; undefined holds the bind pose. */
  clip?: string;
  onLoad?: () => void;
  onError?: (error: unknown) => void;
  /** Where the Viro web renderer's wasm sidecars are served. */
  assetBaseUrl?: string;
};

type SceneProps = Pick<MonModelViewerProps, 'url' | 'scale' | 'position' | 'rotation' | 'clip' | 'onLoad' | 'onError'> & {
  yaw: number;
  extent: TurnExtent;
  stage: { width: number; height: number };
  pitch: number;
};

function MonModelScene({ url, scale, position, rotation, yaw, pitch, extent, stage, clip, onLoad, onError }: SceneProps) {
  const camera = previewCamera(extent, position, stage.width, stage.height, pitch);
  return (
    <ViroScene>
      <ViroOrbitCamera
        position={camera.position}
        focalPoint={camera.focalPoint}
        projection="orthographic"
        orthographicScale={camera.orthographicScale}
        active
      />
      <ViroAmbientLight color={palette.white} intensity={300} />
      <ViroDirectionalLight color={palette.white} direction={[-0.5, -1, -0.6]} intensity={900} />
      {/* key: a new file is a new node, so the old model never lingers under the new one. */}
      <Viro3DObject
        key={url}
        source={{ uri: url }}
        type="GLB"
        scale={[scale, scale, scale]}
        position={position}
        rotation={[rotation[0], rotation[1] + yaw, rotation[2]]}
        animation={clip ? { name: clip, run: true, loop: true } : undefined}
        onLoadEnd={() => onLoad?.()}
        onError={(event: unknown) => onError?.(event)}
      />
    </ViroScene>
  );
}

type NavigatorProps = {
  initialScene: { scene: ComponentType<any> };
  viroAppProps: SceneProps;
  webRendererOptions: { assetBaseUrl: string };
  showReticle?: boolean;
  style?: Record<string, unknown>;
};

const Navigator = Viro3DSceneNavigator as unknown as ComponentType<NavigatorProps>;

type Readable = { from: string; url: string; points: ModelPoints | null };

/**
 * The URL Viro should load for `url`: the same URL, or a blob: URL of a copy
 * Viro can draw when the file is quantized or skinned with 8- or 16-bit joints,
 * both of which Viro draws blank in the browser (glbDequantize.ts). Also the
 * model's bind-pose vertices, read from that float copy, to frame it. Null
 * while the file is being read.
 */
function useViroReadable(url: string, onError?: (error: unknown) => void): Readable | null {
  const [readable, setReadable] = useState<Readable | null>(null);
  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    (async () => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Model request failed (${response.status})`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (cancelled) return;
      if (!needsViroRewrite(bytes)) {
        setReadable({ from: url, url, points: readModelPoints(bytes) });
        return;
      }
      const copy = viroReadableGlb(bytes);
      objectUrl = URL.createObjectURL(new Blob([copy.buffer as ArrayBuffer], { type: 'model/gltf-binary' }));
      setReadable({ from: url, url: objectUrl, points: readModelPoints(copy) });
    })().catch((error: unknown) => {
      if (!cancelled) onError?.(error);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // A new file is a new read; onError changes identity every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);
  return readable?.from === url ? readable : null;
}

type Handlers = Pick<MonModelViewerProps, 'onTurn' | 'onResetTurn'> & { turn: Turn };

/**
 * Drag, double-click and arrow keys on the stage element. Viro web's
 * ViroOrbitCamera is a fixed look-at camera: the canvas forwards pointer
 * events to virocore's input controller for hit testing, and nothing there
 * orbits the camera, so the turn is driven from here. Returns the detach.
 */
function attachStage(element: HTMLElement, latest: { current: Handlers }): () => void {
  let drag: { id: number; x: number; y: number; from: Turn } | null = null;
  element.tabIndex = 0;
  element.style.cursor = 'grab';
  // touch-action applies to the canvas inside too, so a drag never scrolls the page.
  element.style.touchAction = 'none';
  element.style.userSelect = 'none';
  const down = (event: PointerEvent) => {
    if (event.button !== 0) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, from: latest.current.turn };
    element.setPointerCapture(event.pointerId);
    element.style.cursor = 'grabbing';
  };
  const move = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.id) return;
    const rect = element.getBoundingClientRect();
    latest.current.onTurn?.(dragTurn(drag.from, event.clientX - drag.x, event.clientY - drag.y, rect.width, rect.height));
  };
  const up = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.id) return;
    drag = null;
    if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
    element.style.cursor = 'grab';
  };
  const reset = () => latest.current.onResetTurn?.();
  const key = (event: KeyboardEvent) => {
    if (event.altKey || event.metaKey || event.ctrlKey) return;
    if (event.key === 'Home') {
      event.preventDefault();
      reset();
      return;
    }
    const next = keyTurn(latest.current.turn, event.key);
    if (!next) return;
    event.preventDefault();
    latest.current.onTurn?.(next);
  };
  // Keyboard focus only: a click to drag does not draw the ring.
  const focus = () => {
    if (element.matches(':focus-visible')) {
      element.style.outline = `2px solid ${semantic.focus.dark}`;
      element.style.outlineOffset = '2px';
    }
  };
  const blur = () => { element.style.outline = ''; };
  const listeners = [
    ['pointerdown', down], ['pointermove', move], ['pointerup', up], ['pointercancel', up],
    ['dblclick', reset], ['keydown', key], ['focus', focus], ['blur', blur],
  ] as const;
  for (const [type, listener] of listeners) element.addEventListener(type, listener as EventListener);
  return () => {
    for (const [type, listener] of listeners) element.removeEventListener(type, listener as EventListener);
    element.style.cursor = '';
    element.style.touchAction = '';
    element.style.userSelect = '';
    element.style.outline = '';
    element.removeAttribute('tabindex');
  };
}

/** A ref for the stage element that turns the model while `interactive`. */
function useStageTurn(interactive: boolean, handlers: Handlers) {
  const latest = useRef(handlers);
  useLayoutEffect(() => {
    latest.current = handlers;
  });
  const detach = useRef<(() => void) | null>(null);
  useEffect(() => () => {
    detach.current?.();
    detach.current = null;
  }, []);
  return useCallback((node: unknown) => {
    detach.current?.();
    detach.current = null;
    // react-native-web hands back the DOM element.
    if (interactive && node instanceof HTMLElement) detach.current = attachStage(node, latest);
  }, [interactive]);
}

/** One Mon model on a lit stage, rendered by the same Viro runtime the game uses. Drag, or focus and use the arrow keys, to turn it. */
export function MonModelViewer({ assetBaseUrl = '/viro/wasm/', yaw = 0, pitch = 0, onTurn, onResetTurn, turnLabel, heightMeters, ...scene }: MonModelViewerProps) {
  const readable = useViroReadable(scene.url, scene.onError);
  const [stage, setStage] = useState({ width: 1, height: 1 });
  const stageRef = useStageTurn(Boolean(onTurn), { onTurn, onResetTurn, turn: { yaw, pitch } });
  const points = readable?.points ?? null;
  const extent = useMemo(
    () => (points ? turnExtent(points, scene.scale) : fallbackExtent(heightMeters, scene.scale)),
    [points, scene.scale, heightMeters],
  );

  return (
    <View
      ref={stageRef}
      className="relative flex-1"
      aria-label={turnLabel}
      role={onTurn ? 'group' : undefined}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        if (width > 0 && height > 0 && (width !== stage.width || height !== stage.height)) setStage({ width, height });
      }}
    >
      {readable ? (
        <Navigator
          initialScene={{ scene: MonModelScene }}
          viroAppProps={{ ...scene, url: readable.url, yaw, pitch, extent, stage }}
          webRendererOptions={{ assetBaseUrl }}
          showReticle={false}
          // Navigator host props are a style object, not a className target.
          style={{ flex: 1 }}
        />
      ) : null}
    </View>
  );
}
