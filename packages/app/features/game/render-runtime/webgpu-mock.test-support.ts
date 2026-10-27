// react-native-webgpu 0.16.0's own Jest mock (lib/commonjs/mock.js, built
// from src/mock.ts) loaded under node --test. The mock needs `react-native`
// for a View only, so that one import is stubbed. Resolved from @acme/ui,
// which owns the react-native-webgpu dependency.
import { createRequire, registerHooks } from 'node:module';

const RN_STUB = 'file:///react-native-stub.cjs';
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'react-native') return { url: RN_STUB, format: 'commonjs', shortCircuit: true };
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url === RN_STUB) return { source: 'exports.View = function View() { return null; };', format: 'commonjs', shortCircuit: true };
    return next(url, context);
  },
});

const requireFromUi = createRequire(new URL('../../../../ui/package.json', import.meta.url));

export const webgpuMock = requireFromUi('react-native-webgpu/lib/commonjs/mock.js') as {
  importDevice: (pointer: bigint) => GPUDevice;
  adoptTexture: (pointer: bigint) => GPUTexture;
  GPUTextureUsage: GPUTextureUsage;
};

/** A texture of the fake device: one texel stands for the whole texture, enough for corner reads. */
export interface FakeTexture {
  desc: GPUTextureDescriptor;
  owner: object;
  texel: number[];
  destroyed: boolean;
  createView(): { texture: FakeTexture };
  destroy(): void;
}

/**
 * A GPUDevice stand-in that runs commands at encode time: a clear pass
 * writes its colour, copyTextureToBuffer copies the texel. Not a GPU; it lets
 * the probes' control flow and verdicts run in node.
 */
export function fakeDevice() {
  const textures: FakeTexture[] = [];
  const device = {
    textures,
    createTexture(desc: GPUTextureDescriptor): FakeTexture {
      const texture: FakeTexture = {
        desc, owner: device, texel: [0, 0, 0, 0], destroyed: false,
        createView: () => ({ texture }),
        destroy() { texture.destroyed = true; },
      };
      textures.push(texture);
      return texture;
    },
    createBuffer({ size }: { size: number }) {
      const data = new Uint8Array(size);
      return { data, mapAsync: async () => {}, getMappedRange: (offset = 0, length = size) => data.buffer.slice(offset, offset + length), unmap() {}, destroy() {} };
    },
    createCommandEncoder() {
      return {
        beginRenderPass(desc: { colorAttachments: { view: { texture: FakeTexture }; loadOp: string; clearValue: { r: number; g: number; b: number; a: number } }[] }) {
          const att = desc.colorAttachments[0]!;
          if (att.loadOp === 'clear') att.view.texture.texel = [att.clearValue.r, att.clearValue.g, att.clearValue.b, att.clearValue.a].map((v) => Math.round(v * 255));
          return { end() {} };
        },
        copyTextureToBuffer(src: { texture: FakeTexture }, dst: { buffer: { data: Uint8Array } }) {
          dst.buffer.data.set(src.texture.texel, 0);
        },
        finish: () => ({}),
      };
    },
    queue: { submit() {} },
  };
  return device;
}

export type FakeDevice = ReturnType<typeof fakeDevice>;

/**
 * A react-native-skia stand-in bound to one device, as Graphite is: it takes
 * only textures of that device, and a surface's drawing reaches the texture
 * only on flush(), the contract Surface.d.ts `flush` documents.
 */
export function fakeSkia(owner: FakeDevice, options: { pointer?: bigint } = {}) {
  const calls: string[] = [];
  const check = (texture: FakeTexture) => {
    if (texture.owner !== owner) throw new Error('texture is not on the Skia device');
  };
  const skia = {
    calls,
    getNativeDevice: () => options.pointer ?? 7n,
    Surface: {
      MakeFromGPUTexture(texture: FakeTexture) {
        check(texture);
        calls.push('MakeFromGPUTexture');
        let pending: number[] | null = null;
        const canvas = {
          clear(color: Float32Array) { pending = Array.from(color, (v) => Math.round(v * 255)); },
          drawRect() { calls.push('drawRect'); },
        };
        return {
          getCanvas: () => canvas,
          flush(sync?: boolean) {
            calls.push(sync ? 'flush(true)' : 'flush()');
            if (pending) texture.texel = pending;
          },
          dispose() { calls.push('surface.dispose'); },
        };
      },
    },
    Image: {
      MakeImageFromGPUTexture(texture: FakeTexture) {
        check(texture);
        return { dispose() {} };
      },
    },
    XYWHRect: (x: number, y: number, width: number, height: number) => ({ x, y, width, height }),
    Paint: () => ({ setColor() {}, setAntiAlias() {}, dispose() {} }),
  };
  return skia;
}
