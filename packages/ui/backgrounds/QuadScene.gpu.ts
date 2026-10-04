import { d, std, tgpu, type StorageFlag, type TgpuBindGroup, type TgpuBuffer } from 'typegpu';
import type { Rgba } from '../neon/colors';
import type { GpuContext, GpuScene } from '../gpu/types';
import { composeLayers, QUAD_STRIDE, QuadWriter, type Layer, type Pointer } from './quad-writer';

/** What every solid background hands the shared quad scene. */
export interface QuadSceneParams {
  layers: readonly Layer[];
  /** Clear colour (the background), 0-1 RGBA. */
  clear: Rgba;
  pointer: { getState: () => Pointer };
}

// Matches QUAD_STRIDE: corners (8 floats), colour, win, extra = 80 bytes, no
// padding (vec2f aligns to 8 and vec4f to 16, and every field lands on one).
const Quad = d.struct({
  p: d.arrayOf(d.vec2f, 4),
  color: d.vec4f,
  win: d.vec4f,
  extra: d.vec4f,
});

const Params = d.struct({
  resolution: d.vec2f,
  time: d.f32,
  pixelRatio: d.f32,
});

const layout = tgpu.bindGroupLayout({
  quads: { storage: d.arrayOf(Quad), access: 'readonly' },
});

// Two triangles per quad, corners clockwise from top-left.
const CORNER = tgpu.const(d.arrayOf(d.u32, 6), [0, 1, 2, 0, 2, 3]);
const UV = tgpu.const(d.arrayOf(d.vec2f, 4), [d.vec2f(0, 0), d.vec2f(1, 0), d.vec2f(1, 1), d.vec2f(0, 1)]);

const hash2 = (v: d.v2f) => {
  'use gpu';
  return std.fract(std.sin(std.dot(v, d.vec2f(12.9898, 78.233))) * 43758.5453);
};

/**
 * The one TypeGPU scene behind every solid background (SignRain, SubwayLines,
 * StreetPulse, CityHeightfield, RiverTide, RainWindow, CitySkyline, GridFloor,
 * GridScene). Layers write quads on the CPU; this draws them all with a single
 * instanced call. The fragment shader turns each quad kind into its look:
 * lit window grids, rounded pills and station dots, pixel glyphs, rain
 * streaks and glow sprites, all anti-aliased per pixel.
 */
export function createQuadScene(gpu: GpuContext): GpuScene<QuadSceneParams> {
  const { root, device, context, format } = gpu;
  const params = root.createUniform(Params);

  const vertex = tgpu.vertexFn({
    in: { vid: d.builtin.vertexIndex, iid: d.builtin.instanceIndex },
    out: { position: d.builtin.position, uv: d.vec2f, color: d.vec4f, win: d.vec4f, extra: d.vec4f },
  })((input) => {
    'use gpu';
    const q = layout.$.quads[input.iid]!;
    const corner = CORNER.$[input.vid]!;
    const p = d.vec2f(q.p[corner]!);
    const res = params.$.resolution;
    const ndc = d.vec2f((p.x / res.x) * 2 - 1, 1 - (p.y / res.y) * 2);
    return {
      position: d.vec4f(ndc, 0, 1),
      uv: d.vec2f(UV.$[corner]!),
      color: d.vec4f(q.color),
      win: d.vec4f(q.win),
      extra: d.vec4f(q.extra),
    };
  });

  const fragment = tgpu.fragmentFn({
    in: { uv: d.vec2f, color: d.vec4f, win: d.vec4f, extra: d.vec4f },
    out: d.vec4f,
  })((input) => {
    'use gpu';
    let rgb = d.vec3f(input.color.xyz);
    let alpha = d.f32(input.color.w);
    const kind = input.extra.x;
    if (std.abs(kind - 1) < 0.5) {
      // FACADE: a window grid, some lit. A slow per-window clock flips a few
      // lights at a time; under reduced motion time stands still.
      const grid = std.mul(input.uv, d.vec2f(input.win.x, input.win.y));
      const cell = std.floor(grid);
      const local = std.fract(grid);
      const inWindow = std.step(0.2, local.x) * std.step(local.x, 0.8) * std.step(0.24, local.y) * std.step(local.y, 0.76);
      const epoch = std.floor(params.$.time * 0.15 + hash2(std.add(cell, d.vec2f(input.win.z, 3.7))) * 9);
      const lit = std.step(hash2(std.add(cell, d.vec2f(input.win.z, epoch * 0.37))), input.win.w);
      const windowColor = std.mix(std.mul(rgb, 0.55), d.vec3f(input.extra.y, input.extra.z, input.extra.w), lit);
      rgb = std.mix(rgb, windowColor, inWindow);
    } else if (std.abs(kind - 2) < 0.5) {
      // GLOW: hot core, soft halo. The accent, never the structure.
      const dist = std.distance(input.uv, d.vec2f(0.5, 0.5)) * 2;
      const core = 1 - std.smoothstep(0.1, 0.32, dist);
      const halo = std.exp(-dist * dist * 5) * 0.5;
      alpha = std.clamp(core + halo, 0, 1) * input.color.w;
      rgb = std.mix(rgb, d.vec3f(1, 1, 1), core * 0.4);
    } else if (std.abs(kind - 3) < 0.5) {
      // ROUND: signed distance to a rounded box in px, AA over one pixel.
      const size = d.vec2f(input.win.x, input.win.y);
      const r = input.win.z;
      const pos = std.mul(std.sub(input.uv, d.vec2f(0.5, 0.5)), size);
      const q = std.sub(std.abs(pos), std.sub(std.mul(size, 0.5), d.vec2f(r, r)));
      const dist = std.length(std.max(q, d.vec2f(0, 0))) + std.min(std.max(q.x, q.y), 0) - r;
      // One device pixel of AA. Sizes are in layout px, and fwidth is not allowed
      // in the non-uniform branch this sits in.
      const fw = 1 / std.max(params.$.pixelRatio, 1);
      const outer = std.clamp(0.5 - dist / fw, 0, 1);
      const inner = std.clamp(0.5 - (dist + input.win.w) / fw, 0, 1) * std.step(0.001, input.win.w);
      alpha = alpha * (outer - inner);
    } else if (std.abs(kind - 4) < 0.5) {
      // GLYPH: 3x5 pixel font, one bit per pixel, tested with float maths.
      const cell = std.floor(std.mul(input.uv, d.vec2f(3, 5)));
      const local = std.fract(std.mul(input.uv, d.vec2f(3, 5)));
      const index = std.clamp(cell.y, 0, 4) * 3 + std.clamp(cell.x, 0, 2);
      const bit = std.mod(std.floor(input.win.x / std.exp2(index)), 2);
      const gap = input.win.y;
      const inside = std.step(gap, local.x) * std.step(local.x, 1 - gap) * std.step(gap, local.y) * std.step(local.y, 1 - gap);
      alpha = alpha * bit * inside;
    } else if (std.abs(kind - 5) < 0.5) {
      // VIGNETTE: fade to the clear colour at the edges, heavier at the bottom.
      const radial = std.smoothstep(0.42, 0.8, std.distance(input.uv, d.vec2f(0.5, 0.5)));
      const vertical = std.max(std.smoothstep(0.62, 1.05, input.uv.y), std.smoothstep(0.3, -0.05, input.uv.y) * 0.8);
      alpha = std.clamp(std.max(radial, vertical), 0, 1) * input.color.w;
    } else if (std.abs(kind - 6) < 0.5) {
      // STREAK: solid head, fading tail.
      alpha = alpha * std.mix(input.win.x, 1, input.uv.y);
    }
    return d.vec4f(std.mul(rgb, alpha), alpha);
  });

  const pipeline = root.createRenderPipeline({
    vertex,
    fragment,
    targets: {
      format,
      // Premultiplied "over"; the canvas is configured premultiplied too.
      blend: {
        color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
        alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
      },
    },
  });

  let buffer: (TgpuBuffer<ReturnType<typeof d.arrayOf<typeof Quad>>> & StorageFlag) | null = null;
  let bindGroup: TgpuBindGroup | null = null;
  let capacity = 0;
  const writer = new QuadWriter(2048);
  const scratch = new QuadWriter(2048);
  const cache = new WeakMap<Layer, { width: number; height: number; data: Float32Array; count: number }>();

  const ensureCapacity = (count: number) => {
    if (count <= capacity && buffer) return;
    capacity = Math.max(count, Math.ceil(capacity * 1.5), 512);
    buffer?.destroy();
    buffer = root.createBuffer(d.arrayOf(Quad, capacity)).$usage('storage');
    bindGroup = root.createBindGroup(layout, { quads: buffer });
  };

  return {
    render(frame, p) {
      composeLayers(writer, p.layers, { width: frame.width, height: frame.height, time: frame.time, pointer: p.pointer.getState() }, cache, scratch);
      const count = writer.count;
      ensureCapacity(Math.max(count, 1));
      if (count > 0) device.queue.writeBuffer(root.unwrap(buffer!), 0, writer.data, 0, count * QUAD_STRIDE);
      params.write({ resolution: d.vec2f(frame.width, frame.height), time: frame.time, pixelRatio: frame.pixelRatio });
      const [r, g, b, a] = p.clear;
      pipeline
        .with(bindGroup!)
        .withColorAttachment({ view: context, loadOp: 'clear', storeOp: 'store', clearValue: [r * a, g * a, b * a, a] })
        .draw(6, count);
    },
    dispose() {
      buffer?.destroy();
      buffer = null;
      bindGroup = null;
    },
  };
}
