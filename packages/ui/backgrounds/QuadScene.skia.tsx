'use client';

import { useMemo } from 'react';
import {
  BlurMask, Canvas, Fill, Group, LinearGradient, Points, RadialGradient, Rect, vec, Vertices, type SkPoint,
} from 'react-native-skia';
import type { StoreApi } from 'zustand/vanilla';
import { useStore } from '../use-instance-store';
import { useLayoutSize } from '../use-layout-size';
import { View } from '../tw';
import { glyphPixels } from './pixel-font';
import { composeLayers, Kind, QUAD_STRIDE, QuadWriter, windowLit, type Layer, type Pointer } from './quad-writer';
import { useFrameTime } from './use-frame-time';

export interface QuadSceneSkiaProps {
  layers: readonly Layer[];
  /** Background fill as a CSS colour. */
  background: string;
  pointer: StoreApi<Pointer>;
  /** Advance time (false under reduced motion or for still scenes). */
  running: boolean;
}

/** Window cells drawn per frame at most; dense skylines sample every other cell past this. */
const MAX_WINDOWS = 9000;

const colorCache = new Map<number, string>();
function css(r: number, g: number, b: number, a: number) {
  const key = ((Math.round(r * 255) * 256 + Math.round(g * 255)) * 256 + Math.round(b * 255)) * 256 + Math.round(a * 255);
  let hit = colorCache.get(key);
  if (!hit) {
    hit = `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${Math.round(a * 255) / 255})`;
    colorCache.set(key, hit);
  }
  return hit;
}

interface Mesh {
  vertices: SkPoint[];
  colors: string[];
  indices: number[];
  glows: Map<string, { r: number; color: string; points: SkPoint[] }>;
  vignette: number;
}

function pushQuad(mesh: Mesh, ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number, color: string) {
  const base = mesh.vertices.length;
  mesh.vertices.push(vec(ax, ay), vec(bx, by), vec(cx, cy), vec(dx, dy));
  mesh.colors.push(color, color, color, color);
  mesh.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

/** Point at (u, v) inside quad corners p (bilinear). */
function at(d: Float32Array, o: number, u: number, v: number): [number, number] {
  const tx = d[o]! + (d[o + 2]! - d[o]!) * u;
  const ty = d[o + 1]! + (d[o + 3]! - d[o + 1]!) * u;
  const bx = d[o + 6]! + (d[o + 4]! - d[o + 6]!) * u;
  const by = d[o + 7]! + (d[o + 5]! - d[o + 7]!) * u;
  return [tx + (bx - tx) * v, ty + (by - ty) * v];
}

function subQuad(mesh: Mesh, d: Float32Array, o: number, u0: number, v0: number, u1: number, v1: number, color: string) {
  const a = at(d, o, u0, v0);
  const b = at(d, o, u1, v0);
  const c = at(d, o, u1, v1);
  const e = at(d, o, u0, v1);
  pushQuad(mesh, a[0], a[1], b[0], b[1], c[0], c[1], e[0], e[1], color);
}

/** Rounded shapes as polygons in uv space: 16 points around, corners rounded by radius. */
function roundShape(mesh: Mesh, d: Float32Array, o: number, color: string) {
  const w = d[o + 12]!;
  const h = d[o + 13]!;
  const r = d[o + 14]!;
  const ring = d[o + 15]!;
  const outline = (inset: number) => {
    const pts: [number, number][] = [];
    const rr = Math.max(0, r - inset);
    const corners: [number, number, number][] = [
      [w - r, r, -Math.PI / 2], [w - r, h - r, 0], [r, h - r, Math.PI / 2], [r, r, Math.PI],
    ];
    for (const [cx, cy, start] of corners) {
      for (let i = 0; i <= 3; i++) {
        const t = start + (i / 3) * (Math.PI / 2);
        pts.push([(cx + Math.cos(t) * rr) / w, (cy + Math.sin(t) * rr) / h]);
      }
    }
    if (inset > 0) {
      // Pull the straight edges in by the ring thickness.
      return pts.map(([u, v]) => [0.5 + (u - 0.5) * (1 - (2 * inset) / w), 0.5 + (v - 0.5) * (1 - (2 * inset) / h)] as [number, number]);
    }
    return pts;
  };
  const outer = outline(0).map(([u, v]) => at(d, o, u, v));
  if (ring > 0) {
    const inner = outline(ring).map(([u, v]) => at(d, o, u, v));
    for (let i = 0; i < outer.length; i++) {
      const j = (i + 1) % outer.length;
      pushQuad(mesh, outer[i]![0], outer[i]![1], outer[j]![0], outer[j]![1], inner[j]![0], inner[j]![1], inner[i]![0], inner[i]![1], color);
    }
    return;
  }
  const centre = at(d, o, 0.5, 0.5);
  const base = mesh.vertices.length;
  mesh.vertices.push(vec(centre[0], centre[1]));
  mesh.colors.push(color);
  for (const [x, y] of outer) {
    mesh.vertices.push(vec(x, y));
    mesh.colors.push(color);
  }
  for (let i = 0; i < outer.length; i++) mesh.indices.push(base, base + 1 + i, base + 1 + ((i + 1) % outer.length));
}

function buildMesh(writer: QuadWriter, time: number): Mesh {
  const mesh: Mesh = { vertices: [], colors: [], indices: [], glows: new Map(), vignette: 0 };
  const d = writer.data;
  // Spend the window budget from the last-drawn (nearest) facades backwards,
  // then draw in order, so near buildings keep their windows when far ones lose them.
  const windowed = new Set<number>();
  let budget = MAX_WINDOWS;
  for (let i = writer.count - 1; i >= 0 && budget > 0; i--) {
    const o = i * QUAD_STRIDE;
    if (d[o + 16] !== Kind.FACADE) continue;
    const cols = Math.round(d[o + 12]!);
    const rows = Math.round(d[o + 13]!);
    const faceW = Math.hypot(d[o + 2]! - d[o]!, d[o + 3]! - d[o + 1]!);
    const faceH = Math.hypot(d[o + 6]! - d[o]!, d[o + 7]! - d[o + 1]!);
    // Windows under about 3 px read as noise on the CPU path; skip them.
    if (faceW / cols < 3 || faceH / rows < 3) continue;
    windowed.add(i);
    budget -= cols * rows;
  }
  for (let i = 0; i < writer.count; i++) {
    const o = i * QUAD_STRIDE;
    const kind = d[o + 16]!;
    const [r, g, b, a] = [d[o + 8]!, d[o + 9]!, d[o + 10]!, d[o + 11]!];
    if (kind === Kind.GLOW) {
      const radius = Math.round(Math.abs(d[o + 2]! - d[o]!) / 2);
      const color = css(r, g, b, a);
      const key = `${color}|${radius}`;
      let group = mesh.glows.get(key);
      if (!group) {
        group = { r: radius, color, points: [] };
        mesh.glows.set(key, group);
      }
      group.points.push(vec((d[o]! + d[o + 4]!) / 2, (d[o + 1]! + d[o + 5]!) / 2));
      continue;
    }
    if (kind === Kind.VIGNETTE) {
      mesh.vignette = a;
      continue;
    }
    if (kind === Kind.ROUND) {
      roundShape(mesh, d, o, css(r, g, b, a));
      continue;
    }
    if (kind === Kind.GLYPH) {
      const color = css(r, g, b, a);
      const gap = d[o + 13]!;
      for (const [col, row] of glyphPixels(d[o + 12]!)) {
        subQuad(mesh, d, o, (col + gap) / 3, (row + gap) / 5, (col + 1 - gap) / 3, (row + 1 - gap) / 5, color);
      }
      continue;
    }
    if (kind === Kind.STREAK) {
      // No per-pixel fade here: the head half solid, the tail half at the tail alpha.
      const tail = d[o + 12]!;
      subQuad(mesh, d, o, 0, 0, 1, 0.5, css(r, g, b, a * (tail + 1) * 0.5));
      subQuad(mesh, d, o, 0, 0.5, 1, 1, css(r, g, b, a));
      continue;
    }
    pushQuad(mesh, d[o]!, d[o + 1]!, d[o + 2]!, d[o + 3]!, d[o + 4]!, d[o + 5]!, d[o + 6]!, d[o + 7]!, css(r, g, b, a));
    if (windowed.has(i)) {
      const cols = Math.round(d[o + 12]!);
      const rows = Math.round(d[o + 13]!);
      const seed = d[o + 14]!;
      const lit = d[o + 15]!;
      const on = css(d[o + 17]!, d[o + 18]!, d[o + 19]!, a);
      const off = css(r * 0.55, g * 0.55, b * 0.55, a);
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const color = windowLit(col, row, seed, lit, time) ? on : off;
          subQuad(mesh, d, o, (col + 0.2) / cols, (row + 0.24) / rows, (col + 0.8) / cols, (row + 0.76) / rows, color);
        }
      }
    }
  }
  return mesh;
}

/**
 * Skia fallback for every solid background, used where WebGPU is missing.
 * Expands the same quads the GPU scene draws: solids, windows, glyph pixels,
 * pills and dots go into one indexed Vertices call; glows become blurred
 * Points grouped by colour and size. Windows twinkle on the same clock as
 * the shader, sampled per frame on the JS thread.
 */
export default function QuadSceneSkia({ layers, background, pointer, running }: QuadSceneSkiaProps) {
  const { size, onLayout } = useLayoutSize();
  const { width, height } = size;
  const time = useFrameTime(running);
  const pointerState = useStore(pointer);
  // Consecutive static or moving layers form runs. A static run's mesh is
  // rebuilt only when the size changes or the window clock ticks (once a
  // second); moving runs rebuild every frame.
  const runs = useMemo(() => {
    const out: { layers: Layer[]; static: boolean }[] = [];
    for (const layer of layers) {
      const last = out[out.length - 1];
      if (last && last.static === !!layer.static) last.layers.push(layer);
      else out.push({ layers: [layer], static: !!layer.static });
    }
    return out;
  }, [layers]);
  const tools = useMemo(
    () => ({ writer: new QuadWriter(), scratch: new QuadWriter(), cache: new WeakMap<Layer, never>(), meshes: new Map<number, { key: string; mesh: Mesh }>() }),
    [],
  );
  const frame = { width, height, time, pointer: pointerState };
  const meshes = runs.map((run, i) => {
    const key = `${width}x${height}@${Math.floor(time)}`;
    const hit = run.static ? tools.meshes.get(i) : undefined;
    if (hit && hit.key === key) return hit.mesh;
    composeLayers(tools.writer, run.layers, frame, tools.cache, tools.scratch);
    const mesh = buildMesh(tools.writer, time);
    if (run.static) tools.meshes.set(i, { key, mesh });
    return mesh;
  });

  const vignette = Math.max(0, ...meshes.map((m) => m.vignette));

  return (
    <View aria-hidden className="pointer-events-none absolute inset-0" onLayout={onLayout}>
      {/* Skia surface: Canvas takes a style, not a className. */}
      <Canvas style={{ flex: 1 }}>
        <Fill color={background} />
        {meshes.map((mesh, i) => (
          <Group key={i}>
            {mesh.indices.length ? <Vertices vertices={mesh.vertices} colors={mesh.colors} indices={mesh.indices} mode="triangles" /> : null}
            {[...mesh.glows.values()].map((g) => (
              <Group key={`${g.color}|${g.r}`}>
                <Points points={g.points} mode="points" color={g.color} strokeWidth={g.r * 1.1} strokeCap="round" opacity={0.45}>
                  <BlurMask blur={g.r * 0.45} style="normal" />
                </Points>
                <Points points={g.points} mode="points" color={g.color} strokeWidth={Math.max(1.5, g.r * 0.35)} strokeCap="round" />
              </Group>
            ))}
          </Group>
        ))}
        {vignette > 0 ? (
          <Group opacity={vignette}>
            <Rect x={0} y={0} width={width} height={height}>
              <RadialGradient
                c={vec(width / 2, height / 2)}
                r={Math.hypot(width, height) / 2}
                colors={['transparent', 'transparent', background]}
                positions={[0, 0.55, 1]}
              />
            </Rect>
            <Rect x={0} y={0} width={width} height={height}>
              <LinearGradient start={vec(0, 0)} end={vec(0, height)} colors={[background, 'transparent', 'transparent', background]} positions={[0, 0.3, 0.62, 1]} />
            </Rect>
          </Group>
        ) : null}
      </Canvas>
    </View>
  );
}
