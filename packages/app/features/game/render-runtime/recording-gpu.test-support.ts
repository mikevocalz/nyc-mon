// A GPUDevice for node tests that accepts every call and records what the
// renderer asked for: shader modules (with their WGSL), render and compute
// pipelines, buffer and texture bytes, queue writes and draws. It lets
// three's WebGPURenderer run a whole frame (node builds, WGSL generation,
// pipeline and binding creation) without a GPU, so tests can pin what the
// first frame costs on the JS side.
//
// Nothing is rendered; the device only counts.

export interface GpuRecord {
  shaders: string[];
  renderPipelines: number;
  computePipelines: number;
  bufferBytes: number;
  textureBytes: number;
  writes: number;
  writeBytes: number;
  draws: number;
}

const FORMAT_BYTES: Record<string, number> = {
  r8unorm: 1, r16float: 2, rg16float: 4, r32float: 4, rgba8unorm: 4, 'rgba8unorm-srgb': 4, bgra8unorm: 4,
  rg11b10ufloat: 4, depth24plus: 4, 'depth24plus-stencil8': 4, depth32float: 4, rgba16float: 8, rgba32float: 16,
};

/** Any property, any call: a stand-in for the GPU objects nobody here inspects. */
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

function encoder(record: GpuRecord): unknown {
  const pass = () => new Proxy({}, {
    get: (_t, p) => (p === 'then' ? undefined
      : p === 'draw' || p === 'drawIndexed' || p === 'drawIndirect' || p === 'drawIndexedIndirect' ? () => { record.draws++; }
        : () => undefined),
  });
  return new Proxy({}, {
    get: (_t, p) => (p === 'then' ? undefined
      : p === 'beginRenderPass' || p === 'beginComputePass' ? pass
        : p === 'finish' ? () => ({})
          : () => undefined),
  });
}

/** The WebGPU enums three reads as globals; node has none. Idempotent. */
export function installGpuGlobals(): void {
  const g = globalThis as Record<string, unknown>;
  g.GPUTextureUsage ??= { COPY_SRC: 1, COPY_DST: 2, TEXTURE_BINDING: 4, STORAGE_BINDING: 8, RENDER_ATTACHMENT: 16 };
  g.GPUBufferUsage ??= { MAP_READ: 1, MAP_WRITE: 2, COPY_SRC: 4, COPY_DST: 8, INDEX: 16, VERTEX: 32, UNIFORM: 64, STORAGE: 128, INDIRECT: 256, QUERY_RESOLVE: 512 };
  g.GPUShaderStage ??= { VERTEX: 1, FRAGMENT: 2, COMPUTE: 4 };
  g.GPUMapMode ??= { READ: 1, WRITE: 2 };
  g.GPUColorWrite ??= { RED: 1, GREEN: 2, BLUE: 4, ALPHA: 8, ALL: 15 };
  g.GPURenderBundleEncoder ??= class {};
  if (!(navigator as unknown as { gpu?: unknown }).gpu) {
    Object.defineProperty(globalThis, 'navigator', {
      value: { ...navigator, gpu: { getPreferredCanvasFormat: () => 'bgra8unorm' } },
      configurable: true,
    });
  }
  // three's Animation loop reads `self`; a frame callback that never fires keeps it idle.
  g.self ??= globalThis;
  g.requestAnimationFrame ??= () => 0;
  g.cancelAnimationFrame ??= () => {};
}

export function recordingGpuDevice(): { device: unknown; record: GpuRecord } {
  const record: GpuRecord = { shaders: [], renderPipelines: 0, computePipelines: 0, bufferBytes: 0, textureBytes: 0, writes: 0, writeBytes: 0, draws: 0 };
  const limits = new Proxy({}, { get: (_t, p) => (p === 'then' ? undefined : 1 << 28) });
  const device = {
    features: new Set<string>(['float32-filterable']),
    limits,
    lost: new Promise(() => {}),
    queue: {
      writeBuffer: (_b: unknown, _o: number, data: ArrayBufferView, _d?: number, size?: number) => { record.writes++; record.writeBytes += size ?? data.byteLength; },
      writeTexture: (_d: unknown, data: ArrayBufferView) => { record.writeBytes += data.byteLength ?? 0; },
      copyExternalImageToTexture() {},
      submit() {},
      onSubmittedWorkDone: () => Promise.resolve(),
    },
    // Descriptors are reused and reset by three after the call: read everything now.
    createShaderModule: (d: { code: string }) => { record.shaders.push(d.code); return { getCompilationInfo: async () => ({ messages: [] }) }; },
    createRenderPipeline: () => { record.renderPipelines++; return inert(); },
    createRenderPipelineAsync: async () => { record.renderPipelines++; return inert(); },
    createComputePipeline: () => { record.computePipelines++; return inert(); },
    createComputePipelineAsync: async () => { record.computePipelines++; return inert(); },
    createBuffer: (d: { size: number }) => {
      const size = d.size;
      record.bufferBytes += size;
      return { size, getMappedRange: () => new ArrayBuffer(size), unmap() {}, destroy() {}, mapAsync: async () => {} };
    },
    createTexture: (d: { size: { width: number; height?: number; depthOrArrayLayers?: number } | number[]; format: string; sampleCount?: number }) => {
      const s = Array.isArray(d.size)
        ? { width: d.size[0]!, height: d.size[1] ?? 1, depthOrArrayLayers: d.size[2] ?? 1 }
        : { width: d.size.width, height: d.size.height ?? 1, depthOrArrayLayers: d.size.depthOrArrayLayers ?? 1 };
      record.textureBytes += s.width * s.height * s.depthOrArrayLayers * (FORMAT_BYTES[d.format] ?? 4) * (d.sampleCount ?? 1);
      return { ...s, format: d.format, createView: () => inert(), destroy() {} };
    },
    createBindGroup: () => inert(),
    createBindGroupLayout: () => inert(),
    createPipelineLayout: () => inert(),
    createSampler: () => inert(),
    createQuerySet: () => inert(),
    createCommandEncoder: () => encoder(record),
    createRenderBundleEncoder: () => encoder(record),
    pushErrorScope() {},
    popErrorScope: async () => null,
    addEventListener() {},
    destroy() {},
  };
  return { device, record };
}

/** A canvas whose context hands out a drawing-buffer-sized texture each frame. */
export function recordingCanvas(width: number, height: number): unknown {
  const context = {
    configure() {},
    unconfigure() {},
    getCurrentTexture: () => ({ width, height, depthOrArrayLayers: 1, format: 'bgra8unorm', createView: () => inert(), destroy() {} }),
  };
  return { width, height, style: {}, addEventListener() {}, removeEventListener() {}, getContext: () => context };
}
