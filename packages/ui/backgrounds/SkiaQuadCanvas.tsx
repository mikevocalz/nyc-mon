'use client';

import { useEffect, useMemo, useRef } from 'react';
import { PixelRatio, Platform } from 'react-native';
import { useFrameCallback, useSharedValue } from 'react-native-reanimated';
import { BlendMode, Canvas, Fill, Picture, Skia, type SkPicture, type SkVertices } from 'react-native-skia';
import { MeshBuilder, type MeshChunk } from './skia-mesh';
import { quadEffect } from './skia-quad-shader';
import { makeSkVertices } from './skia-vertices';
import { useSrgbDrawingBuffer } from './skia-color-space';
import { View } from '../tw';

/**
 * One step of a Skia fallback scene, drawn in order:
 * - `chunks`: static geometry, tessellated once per size or prop change;
 * - `paint`: geometry rebuilt from the clock (and the pointer). `animated`
 *   steps run every frame while the scene runs; the others only redraw when
 *   `invalidate` fires (the pointer moving).
 */
export type SkiaStep =
  | { chunks: MeshChunk[] }
  | { paint: (mesh: MeshBuilder, time: number) => void; animated: boolean };

export interface SkiaQuadCanvasProps {
  steps: readonly SkiaStep[];
  width: number;
  height: number;
  /** Clear colour (CSS). */
  background: string;
  /** Advance the clock; false under reduced motion (one still frame). */
  running: boolean;
  /** Lit window rect inside a cell: x0, x1, y0, y1. */
  windowRect: readonly [number, number, number, number];
  /** Fires when non-animated paint steps must redraw (a pointer store). */
  invalidate?: { subscribe: (listener: () => void) => () => void };
}

type DrawEntry = { vertices: SkVertices[]; moving: -1 } | { vertices: null; moving: number };

/** What the frame recorder reads; one shared value so a frame sees a consistent set. */
interface Scene {
  list: DrawEntry[];
  moving: SkPicture[];
  width: number;
  height: number;
  window: readonly [number, number, number, number];
  /** Layout px per canvas unit: above the pixel-ratio cap the canvas is drawn smaller and scaled up. */
  scale: number;
  /** Bumped on every change, so the frame callback knows to re-record. */
  version: number;
}

const IS_WEB = Platform.OS === 'web';
/** Device pixel ratio cap for the fallback, the same as GpuCanvas's default. */
const MAX_PIXEL_RATIO = 2;

/** Device pixels per layout px the fallback actually renders at. */
export const fallbackPixelRatio = () => Math.min(PixelRatio.get(), MAX_PIXEL_RATIO);
/** Window lights flip every few seconds each; a 20 Hz clock is plenty for them. */
const WINDOW_CLOCK_HZ = 20;

/**
 * The Skia fallback's renderer. Nothing here re-renders React per frame:
 *
 * - Static steps become SkVertices once (skia-vertices.ts). The window
 *   twinkle, glow falloff and vignette are per-pixel SkSL
 *   (skia-quad-shader.ts) whose only per-frame input is `time`.
 * - A Reanimated frame callback owns the clock and records each frame into
 *   an SkPicture held in a shared value: every static mesh with the shader,
 *   then the moving pictures, in step order. On native it runs on the UI
 *   thread, so a static scene twinkles with no JS at all; on web it runs in
 *   requestAnimationFrame, outside React. The Canvas draws that one Picture.
 * - Moving steps run their layer code (plain JS, shared with the TypeGPU
 *   path) in a requestAnimationFrame loop outside React and publish one
 *   SkPicture each into the scene.
 *
 * The frame is recorded in the frame callback rather than a useDerivedValue
 * because derived values find their inputs through the worklets Babel
 * plugin's closure metadata, which web builds without the plugin (Vite,
 * Storybook) lack: the derived value never updated there.
 */
export function SkiaQuadCanvas({ steps, width, height, background, running, windowRect, invalidate }: SkiaQuadCanvasProps) {
  const effect = useMemo(quadEffect, []);
  const blank = useMemo(() => {
    const recorder = Skia.PictureRecorder();
    recorder.beginRecording();
    return recorder.finishRecordingAsPicture();
  }, []);
  const picture = useSharedValue<SkPicture>(blank);
  // Skia sizes its backing store from the device pixel ratio and takes no
  // cap, so past MAX_PIXEL_RATIO the canvas is laid out smaller by `scale`,
  // drawn scaled down, and the view is scaled back up.
  const scale = Math.max(1, PixelRatio.get() / MAX_PIXEL_RATIO);
  const scene = useSharedValue<Scene>({ list: [], moving: [], width, height, window: windowRect, scale, version: 0 });
  const drawn = useSharedValue({ time: -1, version: -1 });
  const clock = useSharedValue(0);
  // Web frees the previous frame's picture by hand (WASM memory is invisible to the GC).
  const holder = useMemo(() => ({ last: null as SkPicture | null }), []);

  const record = useMemo(() => {
    const fn = (time: number) => {
      'worklet';
      const s = scene.get();
      const recorder = Skia.PictureRecorder();
      const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, s.width, s.height));
      if (s.scale !== 1) canvas.scale(1 / s.scale, 1 / s.scale);
      const paint = Skia.Paint();
      const shader = effect.makeShader([time, s.window[0], s.window[1], s.window[2], s.window[3]]);
      paint.setShader(shader);
      for (const entry of s.list) {
        if (entry.vertices) {
          for (const vertices of entry.vertices) canvas.drawVertices(vertices, BlendMode.Modulate, paint);
        } else {
          const p = s.moving[entry.moving];
          if (p) canvas.drawPicture(p);
        }
      }
      const result = recorder.finishRecordingAsPicture();
      drawn.set({ time, version: s.version });
      picture.set(result);
      if (IS_WEB) {
        shader.dispose();
        paint.dispose();
        recorder.dispose();
        holder.last?.dispose();
        holder.last = result;
      }
    };
    return fn;
  }, [scene, effect, drawn, picture, holder]);

  const update = (patch: Partial<Scene>) => {
    const s = scene.get();
    scene.set({ ...s, ...patch, version: s.version + 1 });
    // Stopped clock: no frame callback to pick the change up, so record now.
    if (!running) record(Math.floor(clock.get() * WINDOW_CLOCK_HZ) / WINDOW_CLOCK_HZ);
  };

  /** Drop objects from the scene before freeing them, so no later frame draws a deleted one. */
  const detach = (patch: Partial<Scene>) => scene.set({ ...scene.get(), ...patch });

  // Static meshes to SkVertices, once per steps. The vertices are made in the
  // effect that frees them, never in a memo: a page left by client navigation
  // stays mounted in a hidden <Activity>, whose effect cleanups run on hide
  // and whose effects run again on return, while memos survive. Vertices
  // memoised and freed in the cleanup would be drawn deleted on return.
  useEffect(() => {
    let index = 0;
    const drawList = steps.map<DrawEntry>((step) =>
      'chunks' in step ? { vertices: step.chunks.map(makeSkVertices), moving: -1 } : { vertices: null, moving: index++ },
    );
    update({ list: drawList, width, height, window: windowRect, scale });
    return () => {
      // Web: free the WASM side now; pictures already recorded keep their own refs.
      detach({ list: [] });
      if (IS_WEB) for (const entry of drawList) entry.vertices?.forEach((v) => v.dispose());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- update is a plain helper over stable shared values.
  }, [steps, width, height, windowRect, scale]);

  // The frame clock and recorder: UI thread on native, rAF on web.
  const frames = useFrameCallback((info) => {
    'worklet';
    const t = clock.get() + Math.min((info.timeSincePreviousFrame ?? 0) / 1000, 0.1);
    clock.set(t);
    const windowTime = Math.floor(t * WINDOW_CLOCK_HZ) / WINDOW_CLOCK_HZ;
    const last = drawn.get();
    if (windowTime !== last.time || scene.get().version !== last.version) record(windowTime);
  }, false);
  useEffect(() => {
    frames.setActive(running);
    return () => frames.setActive(false);
  }, [running, frames]);

  // Moving steps: their own clock on the JS thread, accumulated across
  // resizes so motion does not jump back to zero.
  const movingClock = useRef({ time: 0 });
  useEffect(() => {
    const movers = steps.filter((s): s is Extract<SkiaStep, { paint: unknown }> => 'paint' in s);
    if (!movers.length) return;
    const mesh = new MeshBuilder();
    const bounds = Skia.XYWHRect(0, 0, width, height);
    const [w0, w1, w2, w3] = windowRect;
    let published: SkPicture[] = [];
    const draw = () => {
      const t = movingClock.current.time;
      const pictures = movers.map((step) => {
        mesh.reset();
        step.paint(mesh, t);
        const recorder = Skia.PictureRecorder();
        const canvas = recorder.beginRecording(bounds);
        const paint = Skia.Paint();
        const shader = effect.makeShader([t, w0, w1, w2, w3]);
        paint.setShader(shader);
        for (const chunk of mesh.finish()) {
          const vertices = makeSkVertices(chunk);
          canvas.drawVertices(vertices, BlendMode.Modulate, paint);
          if (IS_WEB) vertices.dispose();
        }
        const result = recorder.finishRecordingAsPicture();
        if (IS_WEB) {
          shader.dispose();
          paint.dispose();
          recorder.dispose();
        }
        return result;
      });
      update({ moving: pictures });
      // Web only: on native the UI thread may still be reading the old
      // pictures, so they are left to the garbage collector.
      if (IS_WEB) for (const p of published) p.dispose();
      published = pictures;
    };

    let frame = 0;
    const loops = running && movers.some((s) => s.animated);
    if (loops) {
      let last = performance.now();
      const tick = (now: number) => {
        movingClock.current.time += Math.min((now - last) / 1000, 0.1);
        last = now;
        draw();
        frame = requestAnimationFrame(tick);
      };
      draw();
      frame = requestAnimationFrame(tick);
    } else {
      draw();
    }
    const unsubscribe = loops ? undefined : invalidate?.subscribe(draw);
    return () => {
      cancelAnimationFrame(frame);
      unsubscribe?.();
      detach({ moving: [] });
      if (IS_WEB) for (const p of published) p.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- update is a plain helper over stable shared values.
  }, [steps, running, width, height, effect, invalidate, windowRect]);

  const host = useRef(null);
  useSrgbDrawingBuffer(host, () => update({}));

  return (
    <View ref={host} className="flex-1">
      {/* Skia surface: Canvas takes a style, not a className; the capped size is computed. */}
      <Canvas style={scale === 1 ? { flex: 1 } : { width: width / scale, height: height / scale, transform: [{ scale }], transformOrigin: 'top left' }}>
        <Fill color={background} />
        <Picture picture={picture} />
      </Canvas>
    </View>
  );
}
