import { gunzipSync } from 'three/examples/jsm/libs/fflate.module.js';
import type { Three } from '@acme/ui/three';
import type { DataTexture, DataArrayTexture, CompressedTexture, CompressedArrayTexture } from 'three/webgpu';
import { platformIo } from '#cell-source-platform';
import type { MaterialPageSpec } from './material-pages.ts';

export interface SourcePageSampler {
  colorSpace: string; wrapS: number; wrapT: number; flipY: boolean; premultiplyAlpha: boolean;
  unpackAlignment: number; minFilter: number; magFilter: number; anisotropy: number; generateMipmaps: boolean;
}
export interface SourcePageMip { width: number; height: number; byteOffset: number; byteLength: number; layerBytes: number }
/** Optional lossless file transport; decoded identity/layout stays on SourcePageSpec. */
export interface SourcePageStorage { encoding: 'gzip'; sha256: string; fileBytes: number; file: string }
export interface SourcePageSpec {
  storage?: SourcePageStorage;
  id: number; sha256: string; sourceBytes: number; gpuBytes: number; width: number; height: number; layers: number;
  compressed?: boolean; compression?: 'astc-4x4'; blockWidth?: number; blockHeight?: number; blockBytes?: number; requiredFeature?: 'texture-compression-astc';
  format: number; type: number; sampler: SourcePageSampler; mipLevels: readonly SourcePageMip[];
}
export interface SourcePageManifest { version: 1; pages: readonly SourcePageSpec[] }
export type SourcePageImage = DataTexture | DataArrayTexture | CompressedTexture | CompressedArrayTexture;
export interface SourcePageTexture {
  bytes: number; texture: SourcePageImage; dispose(): void;
}
const integer = (n: number, min: number, what: string) => {
  if (!Number.isSafeInteger(n) || n < min) throw new Error(`Invalid authored page ${what}`);
};
const aborted = (signal: AbortSignal) => {
  if (signal.aborted) { const error = new Error('Authored page load aborted'); error.name = 'AbortError'; throw error; }
};

/** IDs are manifest-local. Namespace plus payload SHA prevents mapped/PBR/global page-zero collisions. */
export function sourcePageId(namespace: string, page: SourcePageSpec): string {
  if (!/^[a-zA-Z0-9_-]+$/.test(namespace)) throw new Error('Invalid authored page namespace');
  return `${namespace}/${page.id}/${page.sha256}`;
}

function validate(page: SourcePageSpec) {
  integer(page.id, 0, 'ID'); integer(page.width, 1, 'width'); integer(page.height, 1, 'height'); integer(page.layers, 1, 'layers');
  integer(page.sourceBytes, 1, 'source bytes'); integer(page.gpuBytes, 1, 'GPU bytes');
  if (!/^[a-f0-9]{64}$/.test(page.sha256)) throw new Error('Invalid authored page SHA-256');
  if(page.storage){
    const storage=page.storage;integer(storage.fileBytes,1,'stored file bytes');
    if(storage.encoding!=='gzip' || !/^[a-f0-9]{64}$/.test(storage.sha256) || storage.file!==`${storage.sha256}.bin` || page.sourceBytes>=2**32)throw new Error('Invalid authored page storage contract');
  }
  // Exact formats currently emitted by the reviewed packer: RGBA8, R8 and RG8. No channel conversion.
  const bpp = new Map([[1023, 4], [1028, 1], [1030, 2]]).get(page.format);
  const compressed = page.compressed === true;
  if (compressed && (page.format !== 37808 || page.compression !== 'astc-4x4' || page.blockWidth !== 4 || page.blockHeight !== 4 || page.blockBytes !== 16 || page.requiredFeature !== 'texture-compression-astc' || page.width % 4 || page.height % 4)) throw new Error('Invalid authored ASTC4x4 page contract');
  if ((!compressed && !bpp) || page.type !== 1009) throw new Error(`Unsupported authored page format/type ${page.format}/${page.type}`);
  const s = page.sampler;
  if (!s || !['', 'srgb', 'srgb-linear'].includes(s.colorSpace) || ![1000, 1001, 1002].includes(s.wrapS) || ![1000, 1001, 1002].includes(s.wrapT) ||
    ![1003, 1004, 1005, 1006, 1007, 1008].includes(s.minFilter) || ![1003, 1006].includes(s.magFilter) ||
    ![1, 2, 4, 8].includes(s.unpackAlignment) || !Number.isFinite(s.anisotropy) || s.anisotropy < 1 ||
    ['flipY', 'premultiplyAlpha', 'generateMipmaps'].some(k => typeof s[k as keyof SourcePageSampler] !== 'boolean')) throw new Error('Invalid authored page sampler');
  if (!Array.isArray(page.mipLevels) || !page.mipLevels.length) throw new Error('Missing authored page mip layout');
  if (s.premultiplyAlpha) throw new Error('Authored buffer premultiplyAlpha is unsupported by installed Three');
  if (compressed && (s.flipY || s.generateMipmaps || page.mipLevels.length !== Math.floor(Math.log2(Math.max(page.width, page.height))) + 1)) throw new Error('Authored ASTC requires original full mips without flipY/generation');
  if (s.flipY && page.mipLevels.length > 1) throw new Error('Authored explicit mip flipY is unsupported by installed Three');
  const fullCount = Math.floor(Math.log2(Math.max(page.width, page.height))) + 1;
  if (page.mipLevels.length > fullCount || (s.generateMipmaps && page.mipLevels.length !== 1)) throw new Error('Invalid authored page mip policy');
  // Installed r187 WebGPUTextureUtils only uploads level zero for DataArrayTexture. Never silently lose authored levels.
  if (!compressed && page.layers > 1 && page.mipLevels.length > 1) throw new Error('Authored array mip upload is unsupported by installed Three');
  let bytes = 0;
  for (const [i, mip] of page.mipLevels.entries()) {
    const width = Math.max(1, Math.floor(page.width / 2 ** i)), height = Math.max(1, Math.floor(page.height / 2 ** i));
    const layerBytes = compressed ? Math.ceil(width / 4) * Math.ceil(height / 4) * 16 : width * height * bpp!;
    if (mip.width !== width || mip.height !== height || mip.byteOffset !== bytes || mip.layerBytes !== layerBytes || mip.byteLength !== layerBytes * page.layers) throw new Error(`Invalid authored page mip ${i}`);
    bytes += mip.byteLength;
    if (!Number.isSafeInteger(bytes)) throw new Error('Authored page byte overflow');
  }
  if (bytes !== page.sourceBytes) throw new Error('Authored page source byte count mismatch');
  let gpuBytes = bytes;
  if (s.generateMipmaps) for (let i = 1; i < fullCount; i++) gpuBytes += Math.max(1, Math.floor(page.width / 2 ** i)) * Math.max(1, Math.floor(page.height / 2 ** i)) * bpp! * page.layers;
  if (gpuBytes !== page.gpuBytes) throw new Error('Authored page GPU byte count mismatch');
}

/** Scene bank loader: CPU payload verification precedes resource construction; no browser-only crypto on native. */
export function createSourcePageLoader(THREE: Three, options: {
  namespace: string; manifest: SourcePageManifest;
  onReady?(id:string):void;
  /** Returns stored gzip bytes when page.storage exists, otherwise the decoded payload. */
  readPayload(page: SourcePageSpec, signal: AbortSignal): Promise<Uint8Array>;
  /** Enabled GPUDevice features, not merely adapter support. Compressed pages fail closed when absent. */
  hasFeature?(name: string): boolean;
  sha256Hex?(bytes: Uint8Array): Promise<string>;
}) {
  if (options.manifest.version !== 1) throw new Error('Unsupported authored page manifest');
  const pages = new Map<string, SourcePageSpec>(), localIds = new Set<number>();
  for (const original of options.manifest.pages) {
    // Keep the validated manifest immutable from the caller's subsequent edits.
    const page = Object.freeze({ ...original, ...(original.storage ? {storage:Object.freeze({...original.storage})} : {}), sampler: Object.freeze({ ...original.sampler }),
      mipLevels: Object.freeze(original.mipLevels.map(m => Object.freeze({ ...m }))) });
    validate(page);
    if (localIds.has(page.id)) throw new Error('Duplicate authored page ID');
    localIds.add(page.id); pages.set(sourcePageId(options.namespace, page), page);
  }
  const specs: readonly MaterialPageSpec[] = [...pages].map(([id, page]) => ({ id, bytes: page.gpuBytes }));
  return {
    specs,
    async load(id: string, signal: AbortSignal): Promise<SourcePageTexture> {
      const page = pages.get(id);
      if (!page) throw new Error(`Unknown authored page ${id}`);
      aborted(signal);
      if (page.compressed && options.hasFeature?.('texture-compression-astc') !== true) throw new Error('Authored ASTC page requires enabled GPUDevice texture-compression-astc');
      const payload = await options.readPayload(page, signal);
      aborted(signal);
      const stored=page.storage;
      if (!(payload instanceof Uint8Array) || payload.byteLength !== (stored?.fileBytes ?? page.sourceBytes)) throw new Error('Authored page payload size mismatch');
      // Snapshot before either asynchronous hash; readers may reuse pooled input buffers.
      let bytes = payload.slice();
      const sha256=options.sha256Hex ?? platformIo().sha256Hex;
      if(stored){
        if(await sha256(bytes)!==stored.sha256)throw new Error('Authored page stored payload hash mismatch');
        aborted(signal);
        // Reviewed packer emits a single ordinary gzip member with no optional header fields.
        if(bytes.length<18 || bytes[0]!==31 || bytes[1]!==139 || bytes[2]!==8 || bytes[3]!==0)throw new Error('Unsupported authored page gzip header');
        const length=new DataView(bytes.buffer,bytes.byteOffset+bytes.byteLength-4,4).getUint32(0,true);
        if(length!==page.sourceBytes)throw new Error('Authored page gzip decoded size mismatch');
        // fflate0.8.3 never grows an explicit output buffer. The extra byte detects
        // overflowing streams instead of accepting its otherwise silently truncated prefix.
        bytes=gunzipSync(bytes,{out:new Uint8Array(page.sourceBytes+1)});
        if(bytes.byteLength!==page.sourceBytes)throw new Error('Authored page gzip decoded size mismatch');
        aborted(signal);
      }
      const hash = await sha256(bytes);
      aborted(signal);
      if (hash !== page.sha256) throw new Error('Authored page payload hash mismatch');
      let texture: SourcePageImage | undefined;
      try {
        // Copy the verified payload: upstream buffers may be pooled/reused after readPayload resolves.
        const base = page.mipLevels[0]!;
        const data = bytes.subarray(base.byteOffset, base.byteOffset + base.byteLength);
        const mipmaps = page.mipLevels.map(m => ({ data: bytes.subarray(m.byteOffset, m.byteOffset + m.byteLength), width: m.width, height: m.height }));
        texture = page.compressed ? (page.layers === 1
          ? new THREE.CompressedTexture(mipmaps, page.width, page.height, THREE.RGBA_ASTC_4x4_Format, THREE.UnsignedByteType)
          : new THREE.CompressedArrayTexture(mipmaps, page.width, page.height, page.layers, THREE.RGBA_ASTC_4x4_Format, THREE.UnsignedByteType)) : page.layers === 1 ? new THREE.DataTexture(data, page.width, page.height) : new THREE.DataArrayTexture(data, page.width, page.height, page.layers);
        texture.name = `source-page:${id}`;
        texture.format = page.format as DataTexture['format']; texture.type = page.type as DataTexture['type'];
        Object.assign(texture, page.sampler);
        if (!page.compressed && page.mipLevels.length > 1) texture.mipmaps = mipmaps;
        aborted(signal);
        texture.needsUpdate = true;
        let disposed = false;
        const owned = texture;
        // These immutable pages are authenticated again when an evicted texture
        // is recreated. After an actual upload, the GPU owns the sampled bytes;
        // retain dimensions/mip descriptors, not a second full CPU payload.
        owned.onUpdate = () => {
          const image = owned.image as { data?: Uint8Array } | undefined;
          if (image && ArrayBuffer.isView(image.data)) image.data = new Uint8Array(0);
          for (const mip of owned.mipmaps) {
            const level = mip as { data?: Uint8Array };
            if (ArrayBuffer.isView(level.data)) level.data = new Uint8Array(0);
          }
          owned.onUpdate = null;
        };
        options.onReady?.(id);
        return { bytes: page.gpuBytes, texture: owned, dispose() { if (!disposed) { disposed = true; try { owned.dispose(); } finally {
          // Zero-lease eviction owns this texture exclusively. Cached shader nodes can
          // retain its object, so release decoded CPU storage as well as GPU storage.
          owned.mipmaps = [];
          const image = owned.image as { data?: unknown } | undefined;
          if (image && 'data' in image) image.data = null;
        } } } };
      } catch (error) { texture?.dispose(); throw error; }
    },
  };
}
