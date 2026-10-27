'use client';

import { useEffect, useImperativeHandle, useRef } from 'react';
import { PixelRatio, Platform, type GestureResponderEvent } from 'react-native';
import { twMerge } from 'tailwind-merge';
import { useReducedMotion } from '../backgrounds/use-reduced-motion';
import { useGpuState } from '../gpu/gpu-store';
import { useInstance, useInstanceStore, useStore } from '../use-instance-store';
import { useLayoutSize } from '../use-layout-size';
import { View } from '../tw';
import { loadThree } from './load-three';
import { advanceNodeFrame, stopInternalLoop } from './renderer-internals';
import { resolveRenderThread } from './render-thread';
import { WorkletThreeCanvas } from './WorkletThreeCanvas';
import { toNdc } from './pointer';
import { ThreeSurface } from './surface';
import type { ThreeBackend, ThreeCanvasProps, ThreeFrameTiming, ThreePointer, ThreeScene, ThreeSurfaceHandle } from './types';
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
  lastProbeStart: number;
  width: number;
  height: number;
  pixelRatio: number;
  sized: boolean;
  reducedMotion: boolean;
  queued: boolean;
  pointer: ThreePointer;
  frame: { time: number; delta: number; width: number; height: number; pixelRatio: number; reducedMotion: boolean; pointer: ThreePointer };
  /** Reused when onFrameTiming is set: the opt-in probe allocates nothing per frame either. */
  probe: ThreeFrameTiming;
}

const isWeb = Platform.OS === 'web';

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
 *
 * `renderThread="worklet"` (native, opt-in) hands the renderer and the scene
 * to `workletHost` on a worklet runtime instead (WorkletThreeCanvas.tsx).
 */
export function ThreeCanvas<P>(props: ThreeCanvasProps<P>) {
  // Resolved once per mount: switching threads needs a remount (the caller keys the canvas).
  const { thread, reason } = useInstance(() =>
    resolveRenderThread({
      requested: props.renderThread,
      platform: Platform.OS,
      hasHost: props.workletHost !== undefined,
      hostAvailable: props.workletHost?.available() ?? false,
    }),
  );
  useEffect(() => {
    if (reason) console.warn(`[ThreeCanvas] renderThread="worklet" fell back to the JS thread (${reason}).`);
  }, [reason]);
  if (thread === 'worklet' && props.workletHost) return <WorkletThreeCanvas {...props} workletHost={props.workletHost} />;
  return <JsThreeCanvas {...props} />;
}

/** The default path: three.js, the scene update and the draw on the JS thread. */
function JsThreeCanvas<P>({
  load,
  params,
  forceWebGL = false,
  paused = false,
  maxFps,
  maxPixelRatio = 2,
  fallback = null,
  tracksPointer = true,
  accessibilityLabel,
  className,
  opacity = 1,
  background,
  androidSurfaceType,
  freeRun = false,
  rendererParams,
  onBackendChange,
  onFrameTiming,
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
    lastProbeStart: 0,
    width: 0,
    height: 0,
    pixelRatio: 1,
    sized: false,
    reducedMotion,
    queued: false,
    pointer: { x: 0, y: 0, inside: false, pressed: false },
    frame: { time: 0, delta: 0, width: 0, height: 0, pixelRatio: 1, reducedMotion, pointer: { x: 0, y: 0, inside: false, pressed: false } },
    probe: { cpuMs: 0, intervalMs: null, backend: 'webgpu' },
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

  // One-shot pacing diagnostic: pairs the flag votes with the sampler's
  // intervalMs so a build's actual cadence is attributable from logcat.
  useEffect(() => {
    if (Platform.OS === 'android') {
      console.info('[NYC-Mon/perf] canvas pacing', {
        freeRun,
        surface: androidSurfaceType ?? 'auto',
      });
    }
  }, [freeRun, androidSurfaceType]);

  // Draws one frame. The clock advances only while the loop runs, so a still
  // canvas redraws the same moment.
  const draw = () => {
    const rt = runtime.current!;
    rt.queued = false;
    const { renderer, built } = rt;
    if (!renderer || !built || !rt.sized) return;
    const now = performance.now();
    const probeStart = onFrameTiming ? now : 0;
    const probeInterval = onFrameTiming && rt.lastProbeStart > 0 ? probeStart - rt.lastProbeStart : null;
    if (onFrameTiming) rt.lastProbeStart = probeStart;
    let delta = 0;
    if (rt.running) {
      // Clamp so a backgrounded tab doesn't jump the scene forward.
      delta = rt.last ? Math.min((now - rt.last) / 1000, 0.1) : 0;
      rt.time += delta;
      rt.last = now;
    }
    try {
      // The frame object is reused: zero allocation per frame.
      const frame = rt.frame;
      frame.time = rt.time;
      frame.delta = delta;
      frame.width = rt.width;
      frame.height = rt.height;
      frame.pixelRatio = rt.pixelRatio;
      frame.reducedMotion = rt.reducedMotion;
      frame.pointer = rt.pointer;
      // Stage attribution for the opt-in probe (G1): four extra clock reads
      // per frame only while onFrameTiming is set; the flag-off path is
      // unchanged and the staged sample keeps cpuMs = the whole draw.
      const t0 = onFrameTiming ? performance.now() : 0;
      built.update?.(frame, rt.params);
      const t1 = onFrameTiming ? performance.now() : 0;
      advanceNodeFrame(renderer);
      const t2 = onFrameTiming ? performance.now() : 0;
      renderer.render(built.scene, built.camera);
      const t3 = onFrameTiming ? performance.now() : 0;
      rt.surface?.present();
      if (onFrameTiming) {
        try {
          const t4 = performance.now();
          const probe = rt.probe;
          probe.cpuMs = Math.max(0, t4 - probeStart);
          probe.intervalMs = probeInterval;
          probe.backend = (renderer.backend as { isWebGLBackend?: boolean }).isWebGLBackend ? 'webgl2' : 'webgpu';
          probe.updateMs = t1 - t0;
          probe.nodeMs = t2 - t1;
          probe.renderMs = t3 - t2;
          probe.presentMs = t4 - t3;
          const info = renderer.info?.render;
          probe.drawCalls = info?.drawCalls ?? -1;
          probe.triangles = info?.triangles ?? -1;
          probe.bufferW = renderer.domElement?.width ?? -1;
          probe.bufferH = renderer.domElement?.height ?? -1;
          onFrameTiming(probe);
        } catch (error) {
          // A diagnostics callback must never take down the game renderer.
          console.warn('[ThreeCanvas] frame diagnostics failed', error);
        }
      }
    } catch (error) {
      console.error('[ThreeCanvas] render failed.', error);
      status.setState((s) => ({ failed: [...s.failed, (renderer.backend as { isWebGLBackend?: boolean }).isWebGLBackend ? 'webgl2' : 'webgpu'] }));
    }
  };

  const invalidate = () => {
    const rt = runtime.current!;
    if (rt.running || rt.queued) return;
    rt.queued = true;
    // freeRun: on a superseding present path the next frame queues on a
    // zero-delay timer instead of a vsync-locked rAF, so an on-demand loop
    // (paused canvas kept alive by invalidate) is not capped near 30 fps by
    // rAF delivery plus draw time.
    if (freeRun) setTimeout(draw, 0);
    else requestAnimationFrame(draw);
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
      // A remounted native canvas can be a frame or two from having a context
      // with a sized canvas; wait for it (about half a second at most) instead
      // of failing the backend on "width of undefined".
      for (let tries = 0; tries < 30 && !cancelled; tries++) {
        const pendingSurface = surfaceRef.current;
        if (pendingSurface && (pendingSurface.isReady?.() ?? true)) break;
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      }
      const surface = surfaceRef.current;
      if (cancelled || !surface) return;
      renderer = surface.createRenderer(THREE, { backend: using, device, rendererParams });
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
      rt.lastProbeStart = 0;
    };
    // invalidate, applySize and status are stable per instance; hasSize gates the first build only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, hasSize, backend, device, load]);

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
    let timer: ReturnType<typeof setTimeout> | undefined;
    // With maxFps, display frames inside the budget are skipped (a millisecond of slack keeps 60 Hz → 30 fps exact).
    const budgetMs = maxFps !== undefined && maxFps > 0 ? 1000 / maxFps - 1 : 0;
    let lastDraw = 0;
    const tick = () => {
      const now = performance.now();
      if (budgetMs === 0 || now - lastDraw >= budgetMs) {
        lastDraw = now;
        draw();
      }
      if (freeRun) timer = setTimeout(tick, 0);
      else frame = requestAnimationFrame(tick);
    };
    if (freeRun) timer = setTimeout(tick, 0);
    else frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      if (timer !== undefined) clearTimeout(timer);
      rt.running = false;
      rt.last = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, maxFps]);

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
  // lifting it lets the blocks settle back. Native also gets touch handlers:
  // pointer events are not delivered to this view on every RN build, and a
  // touch carries the same locationX/locationY.
  const pointerHandlers = tracksPointer
    ? {
        onPointerMove: setPointer, onPointerDown: pressPointer, onPointerUp: liftPointer, onPointerLeave: releasePointer, onPointerCancel: releasePointer,
        ...(Platform.OS === 'web' ? {} : { onTouchStart: pressPointer, onTouchMove: setPointer, onTouchEnd: liftPointer, onTouchCancel: releasePointer }),
      }
    : {};

  let surface = null;
  if (live) {
    // A backend change needs a fresh canvas: one element can't hold both a
    // webgpu and a webgl2 context.
    surface = <ThreeSurface key={`${backend}-${device ? 'shared' : 'own'}`} ref={surfaceRef} androidSurfaceType={androidSurfaceType} />;
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
