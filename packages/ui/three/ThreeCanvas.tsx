'use client';

import { useEffect, useImperativeHandle, useRef } from 'react';
import { PixelRatio, Platform, type GestureResponderEvent } from 'react-native';
import { twMerge } from 'tailwind-merge';
import { useReducedMotion } from '../backgrounds/use-reduced-motion';
import { useGpuState } from '../gpu/gpu-store';
import { useInstanceStore, useStore } from '../use-instance-store';
import { useLayoutSize } from '../use-layout-size';
import { View } from '../tw';
import { loadThree } from './load-three';
import { toNdc } from './pointer';
import { ThreeSurface } from './surface';
import type { ThreeBackend, ThreeCanvasProps, ThreePointer, ThreeScene, ThreeSurfaceHandle } from './types';
import type { WebGPURenderer } from 'three/webgpu';
import { useOnScreen } from './use-on-screen';

type PointerLike = GestureResponderEvent & {
  currentTarget: { getBoundingClientRect?: () => { left: number; top: number } };
  nativeEvent: { clientX?: number; clientY?: number; locationX?: number; locationY?: number; pointerType?: string };
};

interface Runtime<P> {
  renderer: WebGPURenderer | null;
  built: ThreeScene<P> | null;
  surface: ThreeSurfaceHandle | null;
  params: P;
  running: boolean;
  time: number;
  last: number;
  width: number;
  height: number;
  pixelRatio: number;
  sized: boolean;
  reducedMotion: boolean;
  queued: boolean;
  pointer: ThreePointer;
}

const isWeb = Platform.OS === 'web';

/**
 * three's `Renderer.init()` starts `Animation.start()`, a requestAnimationFrame
 * loop that runs until dispose and only advances `nodeFrame`
 * (three/src/renderers/common/Animation.js, r186). ThreeCanvas already owns a
 * frame loop gated on visibility, so the internal one is stopped after init and
 * each draw advances `nodeFrame` itself. Neither member is public API: if a
 * three upgrade renames them, `stopInternalLoop` warns and the site-qa motion
 * check fails on the idle loop.
 */
type RendererInternals = {
  _animation?: { stop?: () => void } | null;
  _nodes?: { nodeFrame?: { update?: () => void; frameId?: number } } | null;
};
const stopInternalLoop = (renderer: WebGPURenderer) => {
  const animation = (renderer as unknown as RendererInternals)._animation;
  if (typeof animation?.stop !== 'function') {
    console.warn('[ThreeCanvas] three renamed Renderer._animation; its internal frame loop keeps running.');
    return;
  }
  animation.stop();
};
let warnedNodeFrame = false;
const warnNodeFrame = () => {
  if (warnedNodeFrame) return;
  warnedNodeFrame = true;
  console.warn('[ThreeCanvas] three renamed Renderer._nodes.nodeFrame; node-time animation will not advance.');
};
// What Animation.start()'s loop did per frame besides the user callback.
const advanceNodeFrame = (renderer: WebGPURenderer) => {
  const nodeFrame = (renderer as unknown as RendererInternals)._nodes?.nodeFrame;
  if (typeof nodeFrame?.update !== 'function') warnNodeFrame();
  if (renderer.info.autoReset) renderer.info.reset();
  nodeFrame?.update?.();
  if (nodeFrame?.frameId !== undefined) (renderer.info as { frame: number }).frame = nodeFrame.frameId;
};

/**
 * A three.js canvas on WebGPURenderer, with one code path for web and native.
 *
 * - Web with WebGPU: WebGPURenderer's WebGPU backend on a canvas element,
 *   sharing the app's one GPUDevice (the TypeGPU root from `@acme/ui/gpu`).
 * - Web without WebGPU, or `forceWebGL`: the same WebGPURenderer on its WebGL2
 *   backend. TSL materials compile to GLSL, so scenes need no second version.
 * - Native: WebGPURenderer on react-native-webgpu's Dawn canvas, same device,
 *   presenting each frame explicitly. Without WebGPU, `fallback` renders.
 *
 * three.js and the scene load on demand (`load`), so neither lands in the
 * first chunk. The canvas tracks layout size and device pixel ratio (capped at
 * `maxPixelRatio`), runs its frame loop only while on screen, unpaused and
 * without reduced motion (drawing one still frame otherwise), hands the scene
 * the pointer in normalised device coordinates, and disposes the renderer on
 * unmount.
 */
export function ThreeCanvas<P>({
  load,
  params,
  forceWebGL = false,
  paused = false,
  maxPixelRatio = 2,
  fallback = null,
  tracksPointer = true,
  accessibilityLabel,
  className,
  opacity = 1,
  background,
  onBackendChange,
  children,
  ref,
}: ThreeCanvasProps<P>) {
  const gpu = useGpuState();
  const reducedMotion = useReducedMotion();
  const host = useRef<unknown>(null);
  const onScreen = useOnScreen(host);
  const status = useInstanceStore(() => ({ failed: [] as ThreeBackend[] }));
  const failed = useStore(status, (s) => s.failed);
  const { size, onLayout } = useLayoutSize({ width: 0, height: 0 });
  const surfaceRef = useRef<ThreeSurfaceHandle>(null);
  const runtime = useRef<Runtime<P>>(null);
  runtime.current ??= {
    renderer: null,
    built: null,
    surface: null,
    params,
    running: false,
    time: 0,
    last: 0,
    width: 0,
    height: 0,
    pixelRatio: 1,
    sized: false,
    reducedMotion,
    queued: false,
    pointer: { x: 0, y: 0, inside: false, pressed: false },
  };

  // Pick the backend. WebGPU when it works; the WebGL2 backend on web when it
  // doesn't (or when forced, or after WebGPU failed); nothing on native.
  const pending = !(isWeb && forceWebGL) && gpu.support === 'pending';
  let backend: ThreeBackend | null = null;
  if (isWeb && forceWebGL) backend = 'webgl2';
  else if (gpu.support === 'supported' && gpu.root && !failed.includes('webgpu')) backend = 'webgpu';
  else if (isWeb && gpu.support !== 'pending') backend = 'webgl2';
  if (backend && failed.includes(backend)) backend = null;
  const device = backend === 'webgpu' ? (gpu.root?.device ?? null) : null;
  const hasSize = size.width > 0 && size.height > 0;
  const live = !pending && backend !== null;
  const running = live && !paused && !reducedMotion && onScreen;

  // Draws one frame. The clock advances only while the loop runs, so a still
  // canvas redraws the same moment.
  const draw = () => {
    const rt = runtime.current!;
    rt.queued = false;
    const { renderer, built } = rt;
    if (!renderer || !built || !rt.sized) return;
    const now = performance.now();
    let delta = 0;
    if (rt.running) {
      // Clamp so a backgrounded tab doesn't jump the scene forward.
      delta = rt.last ? Math.min((now - rt.last) / 1000, 0.1) : 0;
      rt.time += delta;
      rt.last = now;
    }
    try {
      built.update?.(
        { time: rt.time, delta, width: rt.width, height: rt.height, pixelRatio: rt.pixelRatio, reducedMotion: rt.reducedMotion, pointer: rt.pointer },
        rt.params,
      );
      advanceNodeFrame(renderer);
      renderer.render(built.scene, built.camera);
      rt.surface?.present();
    } catch (error) {
      console.error('[ThreeCanvas] render failed.', error);
      status.setState((s) => ({ failed: [...s.failed, (renderer.backend as { isWebGLBackend?: boolean }).isWebGLBackend ? 'webgl2' : 'webgpu'] }));
    }
  };

  const invalidate = () => {
    const rt = runtime.current!;
    if (rt.running || rt.queued) return;
    rt.queued = true;
    requestAnimationFrame(draw);
  };

  useImperativeHandle(ref, () => ({ invalidate }));

  useEffect(() => {
    if (!pending && backend === null) onBackendChange?.(null);
  }, [pending, backend, onBackendChange]);

  // Latest params and motion setting; a still canvas redraws so prop changes show.
  useEffect(() => {
    const rt = runtime.current!;
    rt.params = params;
    rt.reducedMotion = reducedMotion;
    invalidate();
  });

  // Build the renderer and scene once per backend, device and loader.
  useEffect(() => {
    if (pending || !backend || !hasSize) return;
    const rt = runtime.current!;
    const using: ThreeBackend = backend;
    let cancelled = false;
    let renderer: WebGPURenderer | null = null;
    let built: ThreeScene<P> | null = null;
    const start = async () => {
      const [THREE, setup] = await Promise.all([loadThree(), load()]);
      const surface = surfaceRef.current;
      if (cancelled || !surface) return;
      renderer = surface.createRenderer(THREE, { backend: using, device });
      await renderer.init();
      stopInternalLoop(renderer);
      if (cancelled) return;
      built = setup({ THREE, renderer, backend: using, invalidate }, rt.params);
      rt.renderer = renderer;
      rt.built = built;
      rt.surface = surface;
      rt.sized = false;
      applySize();
      onBackendChange?.(using);
      invalidate();
    };
    start().catch((error: unknown) => {
      if (cancelled) return;
      console.error(`[ThreeCanvas] the ${using} backend failed to start.`, error);
      status.setState((s) => ({ failed: [...s.failed, using] }));
    });
    return () => {
      cancelled = true;
      built?.dispose?.();
      renderer?.dispose();
      rt.renderer = null;
      rt.built = null;
      rt.surface = null;
    };
    // invalidate, applySize and status are stable per instance; hasSize gates the first build only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, hasSize, backend, device, load]);

  // Drawing buffer follows layout size and the capped device pixel ratio.
  const applySize = () => {
    const rt = runtime.current!;
    const { renderer, built } = rt;
    if (!renderer || !built || size.width <= 0 || size.height <= 0) return;
    const pixelRatio = Math.min(PixelRatio.get(), maxPixelRatio);
    if (rt.sized && rt.width === size.width && rt.height === size.height && rt.pixelRatio === pixelRatio) return;
    rt.width = size.width;
    rt.height = size.height;
    rt.pixelRatio = pixelRatio;
    renderer.setPixelRatio(pixelRatio);
    // false: the canvas keeps its 100% CSS size; only the drawing buffer changes.
    renderer.setSize(size.width, size.height, false);
    built.resize?.(size.width, size.height);
    rt.sized = true;
  };
  useEffect(() => {
    applySize();
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.width, size.height, maxPixelRatio]);

  // The frame loop: on screen, unpaused, motion allowed.
  useEffect(() => {
    const rt = runtime.current!;
    rt.running = running;
    if (!running) {
      rt.last = 0;
      invalidate();
      return;
    }
    let frame = 0;
    const tick = () => {
      draw();
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      rt.running = false;
      rt.last = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const setPointer = (event: PointerLike) => {
    const rt = runtime.current!;
    const rect = event.currentTarget.getBoundingClientRect?.();
    const { clientX, clientY, locationX, locationY } = event.nativeEvent;
    const x = rect && clientX !== undefined ? clientX - rect.left : locationX;
    const y = rect && clientY !== undefined ? clientY - rect.top : locationY;
    if (x === undefined || y === undefined) return;
    rt.pointer = { ...toNdc(x, y, size.width, size.height), pressed: rt.pointer.pressed };
    invalidate();
  };
  const pressPointer = (event: PointerLike) => {
    setPointer(event);
    runtime.current!.pointer = { ...runtime.current!.pointer, pressed: true };
    invalidate();
  };
  const liftPointer = (event: PointerLike) => {
    const rt = runtime.current!;
    rt.pointer = { ...rt.pointer, pressed: false };
    if (event.nativeEvent.pointerType !== 'mouse') rt.pointer = { ...rt.pointer, inside: false };
    invalidate();
  };
  const releasePointer = () => {
    runtime.current!.pointer = { ...runtime.current!.pointer, inside: false, pressed: false };
    invalidate();
  };
  // Mouse hover on web; on native a finger down or dragging counts, and
  // lifting it lets the blocks settle back.
  const pointerHandlers = tracksPointer
    ? { onPointerMove: setPointer, onPointerDown: pressPointer, onPointerUp: liftPointer, onPointerLeave: releasePointer, onPointerCancel: releasePointer }
    : {};

  let surface = null;
  if (live) {
    // A backend change needs a fresh canvas: one element can't hold both a
    // webgpu and a webgl2 context.
    surface = <ThreeSurface key={`${backend}-${device ? 'shared' : 'own'}`} ref={surfaceRef} />;
  } else if (!pending) {
    surface = fallback;
  }

  return (
    <View
      ref={host as never}
      className={twMerge('relative flex-1 overflow-hidden', className)}
      // Computed: the fill is a caller colour prop, not a theme token.
      style={background ? { backgroundColor: background } : undefined}
      onLayout={onLayout}
      {...(pointerHandlers as object)}
    >
      <View
        className="pointer-events-none absolute inset-0"
        aria-hidden={accessibilityLabel ? undefined : true}
        aria-label={accessibilityLabel}
        role={accessibilityLabel ? 'img' : undefined}
        // Computed: opacity is a numeric caller prop.
        style={opacity < 1 ? { opacity } : undefined}
      >
        {surface}
      </View>
      {children}
    </View>
  );
}
