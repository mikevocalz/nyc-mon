import { d, std, tgpu, type StorageFlag, type TgpuBindGroup, type TgpuBuffer } from 'typegpu';
import { brand } from '@acme/theme';
import { parseColor } from '../neon/colors';
import type { GpuContext, GpuScene } from '../gpu/types';
import {
  blockAt, buildCity, hoverQuad, packQuads, QUAD_FLOATS, trafficAt, trafficCapacity, vignetteQuad,
  type CityInput, type CityLayout, type District, type TrafficOptions,
} from './city-blocks-model';
import type { CityPointer } from './CityBlocks.types';

/** Everything the scene reads each frame. Built by the CityBlocks shell. */
export interface CityParams {
  city: Omit<CityInput, 'width' | 'height'>;
  traffic: TrafficOptions;
  hoverEffect: boolean;
  hoverColor: string;
  overlay: boolean;
  streetColor: string;
  pointer: { getState: () => CityPointer };
}

// Matches packQuads: 4 corners (8 floats), colour (4), win (4) = 64 bytes,
// no padding (vec2f aligns to 8, vec4f to 16, and both land on boundaries).
const Quad = d.struct({
  p: d.arrayOf(d.vec2f, 4),
  color: d.vec4f,
  win: d.vec4f,
});

const Params = d.struct({
  resolution: d.vec2f,
  time: d.f32,
  pixelRatio: d.f32,
  light: d.vec4f,
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

type Scene = GpuScene<CityParams>;

export function createCityBlocksScene(gpu: GpuContext): Scene {
  const { root, device, context, format } = gpu;
  const params = root.createUniform(Params);

  const vertex = tgpu.vertexFn({
    in: { vid: d.builtin.vertexIndex, iid: d.builtin.instanceIndex },
    out: { position: d.builtin.position, uv: d.vec2f, color: d.vec4f, win: d.vec4f },
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
    };
  });

  // One fragment shader for every quad kind (see QuadKind in the model).
  const fragment = tgpu.fragmentFn({
    in: { uv: d.vec2f, color: d.vec4f, win: d.vec4f },
    out: d.vec4f,
  })((input) => {
    'use gpu';
    let rgb = d.vec3f(input.color.xyz);
    let alpha = d.f32(input.color.w);
    const kind = input.win.x;
    if (kind > 0.5) {
      // Facade: a grid of windows, some lit. A slow per-window clock flips
      // a few lights at a time; under reduced motion time stands still.
      const grid = std.mul(input.uv, d.vec2f(input.win.x, input.win.y));
      const cell = std.floor(grid);
      const local = std.fract(grid);
      const inWindow = std.step(0.22, local.x) * std.step(local.x, 0.78) * std.step(0.28, local.y) * std.step(local.y, 0.74);
      const epoch = std.floor(params.$.time * 0.15 + hash2(std.add(cell, d.vec2f(input.win.z, 3.7))) * 9);
      const lit = std.step(hash2(std.add(cell, d.vec2f(input.win.z, epoch * 0.37))), input.win.w);
      const windowColor = std.mix(std.mul(rgb, 0.55), params.$.light.xyz, lit);
      rgb = std.mix(rgb, windowColor, inWindow);
    } else if (kind < -2.5) {
      // Vignette: fade to night at the edges, heavier at the bottom.
      const radial = std.smoothstep(0.42, 0.8, std.distance(input.uv, d.vec2f(0.5, 0.5)));
      const vertical = std.max(std.smoothstep(0.6, 1.05, input.uv.y), std.smoothstep(0.32, -0.05, input.uv.y) * 0.8);
      alpha = std.clamp(std.max(radial, vertical), 0, 1) * input.color.w;
    } else if (kind < -1.5) {
      // Roof: a darker bevel band around the edge reads as a parapet.
      const ex = std.min(input.uv.x, 1 - input.uv.x) / std.max(input.win.y, 0.0001);
      const ey = std.min(input.uv.y, 1 - input.uv.y) / std.max(input.win.z, 0.0001);
      rgb = std.mul(rgb, std.mix(0.78, 1.01, std.step(1, std.min(ex, ey))));
    } else if (kind < -0.5) {
      // Glow sprite: hot core, soft halo. The accent, not the structure.
      const dist = std.distance(input.uv, d.vec2f(0.5, 0.5)) * 2;
      const core = 1 - std.smoothstep(0.1, 0.32, dist);
      const halo = std.exp(-dist * dist * 5) * 0.5;
      alpha = std.clamp(core + halo, 0, 1) * input.color.w;
      rgb = std.mix(rgb, d.vec3f(1, 1, 1), core * 0.45);
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
  let data = new Float32Array(0);

  let city: CityLayout | null = null;
  let cityKey = '';
  let staticCount = 0;
  let trafficSlots = 0;
  let hovered = -2;
  let hoverColorKey = '';
  let lastTrafficTime = -1;

  const ensureCapacity = (count: number) => {
    if (count <= capacity && buffer) return;
    capacity = Math.max(count, Math.ceil(capacity * 1.5), 256);
    buffer?.destroy();
    buffer = root.createBuffer(d.arrayOf(Quad, capacity)).$usage('storage');
    bindGroup = root.createBindGroup(layout, { quads: buffer });
    data = new Float32Array(capacity * QUAD_FLOATS);
  };

  const upload = (fromQuad: number, quadCount: number) => {
    if (!buffer || quadCount <= 0) return;
    device.queue.writeBuffer(
      root.unwrap(buffer),
      fromQuad * QUAD_FLOATS * 4,
      data,
      fromQuad * QUAD_FLOATS,
      quadCount * QUAD_FLOATS,
    );
  };

  return {
    render(frame, p) {
      const width = frame.width;
      const height = frame.height;
      const key = JSON.stringify([width, height, p.city, p.traffic.density, p.overlay]);
      if (key !== cityKey) {
        cityKey = key;
        city = buildCity({ ...p.city, width, height });
        staticCount = city.quads.length;
        trafficSlots = trafficCapacity(city, p.traffic.density);
        ensureCapacity(staticCount + trafficSlots + 1);
        data.fill(0);
        packQuads(city.quads, data);
        packQuads([p.overlay ? vignetteQuad(width, height) : { p: [0, 0, 0, 0, 0, 0, 0, 0], color: [0, 0, 0, 0], win: [0, 0, 0, 0] }], data, staticCount + trafficSlots);
        upload(0, staticCount + trafficSlots + 1);
        hovered = -2;
        lastTrafficTime = -1;
      }
      if (!city) return;

      // Hover: one quad slot under the buildings, rewritten only on change.
      const pointer = p.pointer.getState();
      const nextHover = p.hoverEffect && pointer.inside ? blockAt(city, pointer.x, pointer.y) : -1;
      if (nextHover !== hovered || p.hoverColor !== hoverColorKey) {
        hovered = nextHover;
        hoverColorKey = p.hoverColor;
        packQuads([hoverQuad(city, hovered, p.hoverColor)], data, city.hoverSlot);
        upload(city.hoverSlot, 1);
      }

      // Traffic: rewrite only the dynamic slots, and only when time moved.
      if (frame.time !== lastTrafficTime) {
        lastTrafficTime = frame.time;
        const cars = trafficAt(city, p.city.district as District, frame.time, p.traffic).slice(0, trafficSlots);
        data.fill(0, staticCount * QUAD_FLOATS, (staticCount + trafficSlots) * QUAD_FLOATS);
        packQuads(cars, data, staticCount);
        upload(staticCount, trafficSlots);
      }

      params.write({
        resolution: d.vec2f(width, height),
        time: frame.time,
        pixelRatio: frame.pixelRatio,
        light: d.vec4f(...city.light),
      });

      const [r, g, b] = parseColor(p.streetColor || brand.night);
      pipeline
        .with(bindGroup!)
        .withColorAttachment({ view: context, loadOp: 'clear', storeOp: 'store', clearValue: [r, g, b, 1] })
        .draw(6, staticCount + trafficSlots + 1);
    },
    dispose() {
      buffer?.destroy();
      buffer = null;
      bindGroup = null;
    },
  };
}
