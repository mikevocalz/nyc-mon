// A GPUDevice for node tests that keeps what the recording device only counts:
// every buffer's bytes (mapped-at-creation contents and later queue writes),
// every render pipeline's vertex layout and WGSL, and each render pass's
// commands (pipeline, vertex and index buffers, drawIndexed). A test can then
// fetch the vertices a draw would read, the way the GPU would, and check the
// triangles it would rasterise without a rasteriser.
import { installGpuGlobals, recordingCanvas } from './recording-gpu.test-support.ts';

export { installGpuGlobals, recordingCanvas };

export interface CapturedBuffer { readonly label: string; readonly usage: number; readonly bytes: Uint8Array }
export interface CapturedAttribute { readonly shaderLocation: number; readonly offset: number; readonly format: string }
export interface CapturedVertexBuffer { readonly arrayStride: number; readonly stepMode: string; readonly attributes: readonly CapturedAttribute[] }
export interface CapturedPipeline { readonly label: string; readonly vertexCode: string; readonly buffers: readonly CapturedVertexBuffer[] }
export interface CapturedDraw {
  readonly pipeline: CapturedPipeline;
  readonly vertexBuffers: readonly (CapturedBuffer | undefined)[];
  readonly index: { readonly buffer: CapturedBuffer; readonly format: string } | null;
  readonly indexCount: number;
  readonly instanceCount: number;
  readonly firstIndex: number;
  readonly baseVertex: number;
  readonly firstInstance: number;
}

function inert(): unknown {
  const target = function () {} as unknown as Record<PropertyKey, unknown>;
  return new Proxy(target, {
    get(t, p) {
      if (p === 'then') return undefined;
      if (!(p in t)) t[p] = inert();
      return t[p];
    },
    apply: () => inert(),
  });
}

/** A device that keeps buffers, pipelines and indexed draws (see the header). `draws` resets with `clearDraws`. */
export function captureGpuDevice(): { device: unknown; draws: CapturedDraw[]; clearDraws(): void } {
  const draws: CapturedDraw[] = [];
  const buffers = new WeakMap<object, CapturedBuffer>();
  const pipelines = new WeakMap<object, CapturedPipeline>();
  const modules = new WeakMap<object, string>();
  const limits = new Proxy({}, { get: (_t, p) => (p === 'then' ? undefined : p === 'maxVertexBuffers' ? 8 : 1 << 28) });
  const pipeline = (d: { label?: string; vertex: { module: object; buffers?: readonly CapturedVertexBuffer[] } }) => {
    const handle = inert() as object;
    pipelines.set(handle, {
      label: d.label ?? '',
      vertexCode: modules.get(d.vertex.module) ?? '',
      buffers: (d.vertex.buffers ?? []).map((b) => ({
        arrayStride: b.arrayStride, stepMode: b.stepMode ?? 'vertex',
        attributes: b.attributes.map((a) => ({ shaderLocation: a.shaderLocation, offset: a.offset, format: a.format })),
      })),
    });
    return handle;
  };
  const pass = () => {
    let current: CapturedPipeline | null = null;
    const vbs: (CapturedBuffer | undefined)[] = [];
    let index: CapturedDraw['index'] = null;
    return new Proxy({}, {
      get: (_t, p) => {
        if (p === 'then') return undefined;
        if (p === 'setPipeline') return (h: object) => { current = pipelines.get(h) ?? null; };
        if (p === 'setVertexBuffer') return (slot: number, b: object) => { vbs[slot] = buffers.get(b); };
        if (p === 'setIndexBuffer') return (b: object, format: string) => { index = { buffer: buffers.get(b)!, format }; };
        if (p === 'drawIndexed') {
          return (indexCount: number, instanceCount = 1, firstIndex = 0, baseVertex = 0, firstInstance = 0) => {
            if (current) draws.push({ pipeline: current, vertexBuffers: [...vbs], index, indexCount, instanceCount, firstIndex, baseVertex, firstInstance });
          };
        }
        return () => undefined;
      },
    });
  };
  const encoder = () => new Proxy({}, {
    get: (_t, p) => (p === 'then' ? undefined : p === 'beginRenderPass' ? pass : p === 'finish' ? () => ({}) : () => undefined),
  });
  const device = {
    features: new Set<string>(['float32-filterable']),
    limits,
    lost: new Promise(() => {}),
    queue: {
      writeBuffer: (b: object, offset: number, data: ArrayBufferView, dataOffset = 0, size?: number) => {
        const target = buffers.get(b);
        if (!target) return;
        const unit = 'BYTES_PER_ELEMENT' in data ? (data as unknown as { BYTES_PER_ELEMENT: number }).BYTES_PER_ELEMENT : 1;
        const src = new Uint8Array(data.buffer, data.byteOffset + dataOffset * unit, size !== undefined ? size * unit : data.byteLength - dataOffset * unit);
        target.bytes.set(src.subarray(0, Math.min(src.length, target.bytes.length - offset)), offset);
      },
      writeTexture() {},
      copyExternalImageToTexture() {},
      submit() {},
      onSubmittedWorkDone: () => Promise.resolve(),
    },
    createShaderModule: (d: { code: string }) => { const m = {}; modules.set(m, d.code); return Object.assign(m, { getCompilationInfo: async () => ({ messages: [] }) }); },
    createRenderPipeline: pipeline,
    createRenderPipelineAsync: async (d: Parameters<typeof pipeline>[0]) => pipeline(d),
    createComputePipeline: () => inert(),
    createComputePipelineAsync: async () => inert(),
    createBuffer: (d: { label?: string; size: number; usage: number }) => {
      const bytes = new Uint8Array(d.size);
      const handle = { size: d.size, getMappedRange: () => bytes.buffer, unmap() {}, destroy() {}, mapAsync: async () => {} };
      buffers.set(handle, { label: d.label ?? '', usage: d.usage, bytes });
      return handle;
    },
    createTexture: (d: { size: { width: number; height?: number; depthOrArrayLayers?: number } | number[]; format: string; mipLevelCount?: number }) => {
      const s = Array.isArray(d.size) ? { width: d.size[0]!, height: d.size[1] ?? 1, depthOrArrayLayers: d.size[2] ?? 1 } : { width: d.size.width, height: d.size.height ?? 1, depthOrArrayLayers: d.size.depthOrArrayLayers ?? 1 };
      return { ...s, mipLevelCount: d.mipLevelCount ?? 1, format: d.format, createView: () => inert(), destroy() {} };
    },
    createBindGroup: () => inert(),
    createBindGroupLayout: () => inert(),
    createPipelineLayout: () => inert(),
    createSampler: () => inert(),
    createQuerySet: () => inert(),
    createCommandEncoder: encoder,
    createRenderBundleEncoder: encoder,
    pushErrorScope() {},
    popErrorScope: async () => null,
    addEventListener() {},
    destroy() {},
  };
  return { device, draws, clearDraws: () => { draws.length = 0; } };
}

/** The WGSL vertex input names by @location, read from the pipeline's vertex shader. */
export function vertexInputNames(code: string): Map<number, string> {
  const out = new Map<number, string>();
  for (const m of code.matchAll(/@location\(\s*(\d+)\s*\)\s*(\w+)\s*:/g)) out.set(Number(m[1]), m[2]!);
  return out;
}

const FORMAT: Record<string, readonly [ctor: 'f32' | 'u32' | 'i32', n: number]> = {
  float32: ['f32', 1], float32x2: ['f32', 2], float32x3: ['f32', 3], float32x4: ['f32', 4],
  uint32: ['u32', 1], uint32x2: ['u32', 2], uint32x3: ['u32', 3], uint32x4: ['u32', 4],
  sint32: ['i32', 1], sint32x2: ['i32', 2], sint32x3: ['i32', 3], sint32x4: ['i32', 4],
};

/**
 * Reads attribute `name` for vertex `vertex` of instance `instance` of `draw`, as the vertex fetch would: by the
 * pipeline's layout (slot, stride, offset, format) from the bound buffer. Null if the pipeline has no such input.
 */
export function fetchAttribute(draw: CapturedDraw, name: string, vertex: number, instance: number): number[] | null {
  const names = vertexInputNames(draw.pipeline.vertexCode);
  for (let slot = 0; slot < draw.pipeline.buffers.length; slot++) {
    const layout = draw.pipeline.buffers[slot]!;
    for (const a of layout.attributes) {
      if (names.get(a.shaderLocation) !== name) continue;
      const buffer = draw.vertexBuffers[slot];
      if (!buffer) throw new Error(`${name}: slot ${slot} has no buffer bound`);
      const fmt = FORMAT[a.format];
      if (!fmt) throw new Error(`${name}: format ${a.format} not handled`);
      const element = layout.stepMode === 'instance' ? draw.firstInstance + instance : draw.baseVertex + vertex;
      const at = element * layout.arrayStride + a.offset;
      if (at + fmt[1] * 4 > buffer.bytes.length) throw new Error(`${name}: read past the end of '${buffer.label}' (${at} of ${buffer.bytes.length})`);
      const dv = new DataView(buffer.bytes.buffer, buffer.bytes.byteOffset + at);
      const out: number[] = [];
      for (let k = 0; k < fmt[1]; k++) out.push(fmt[0] === 'f32' ? dv.getFloat32(k * 4, true) : fmt[0] === 'u32' ? dv.getUint32(k * 4, true) : dv.getInt32(k * 4, true));
      return out;
    }
  }
  return null;
}

/** The index list a draw reads, as the index fetch would. */
export function drawIndices(draw: CapturedDraw): Uint32Array {
  if (!draw.index) throw new Error('not an indexed draw');
  const { buffer, format } = draw.index;
  const size = format === 'uint16' ? 2 : 4;
  const end = (draw.firstIndex + draw.indexCount) * size;
  if (end > buffer.bytes.length) throw new Error(`index read past the end of '${buffer.label}' (${end} of ${buffer.bytes.length})`);
  const dv = new DataView(buffer.bytes.buffer, buffer.bytes.byteOffset + draw.firstIndex * size);
  const out = new Uint32Array(draw.indexCount);
  for (let i = 0; i < draw.indexCount; i++) out[i] = size === 2 ? dv.getUint16(i * 2, true) : dv.getUint32(i * 4, true);
  return out;
}
