import { createHash } from 'node:crypto';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const positive = (value, name) => {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`Invalid ${name}: ${value}`);
  return value;
};
const pixelLayout = texture => {
  // Three r187 constants. Other source formats require an explicit reviewed conversion.
  if (texture.compressed) {
    if (texture.format !== 37808 || texture.type !== 1009 || texture.compression !== 'astc-4x4' || texture.requiredFeature !== 'texture-compression-astc') throw new Error(`Texture ${texture.uuid}: unsupported compressed payload`);
    if (texture.generateMipmaps) throw new Error(`Texture ${texture.uuid}: compressed source requires original explicit mips`);
    if (!/^[a-f0-9]{64}$/.test(texture.basis?.jsSha256 ?? '') || !/^[a-f0-9]{64}$/.test(texture.basis?.wasmSha256 ?? '')) throw new Error(`Texture ${texture.uuid}: missing reviewed Basis provenance`);
    return { bytes: (width, height) => Math.ceil(width / 4) * Math.ceil(height / 4) * 16, compressed: true };
  }
  const channels = new Map([[1023, 4], [1028, 1], [1030, 2]]).get(texture.format);
  if (!channels || texture.type !== 1009) throw new Error(`Texture ${texture.uuid}: unsupported native payload ${texture.format}/${texture.type}`);
  return { bytes: (width, height) => width * height * channels, compressed: false };
};
const samplerFields = ['colorSpace', 'wrapS', 'wrapT', 'flipY', 'premultiplyAlpha', 'unpackAlignment', 'minFilter', 'magFilter', 'anisotropy', 'generateMipmaps'];

/**
 * Lossless layered pages: no resize, channel packing, row flip or sampler changes.
 * Heterogeneous dimensions/samplers stay separate. Atlas optimization must be a
 * separate explicit layout, rather than padding every image to a giant square.
 * readPayload receives the captured SHA; writePage receives exact level-major bytes.
 */
export async function packSurfaceTextures(textures, { readPayload, writePage, maxPageBytes, maxLayers }) {
  positive(maxPageBytes, 'page byte cap'); positive(maxLayers, 'array layer cap');
  const groups = new Map(), descriptors = [], seen = new Map();
  for (const texture of textures) {
    if (!/^[a-f0-9]{64}$/.test(texture.sha256)) throw new Error(`Texture ${texture.uuid}: missing payload SHA-256`);
    positive(texture.width, 'texture width'); positive(texture.height, 'texture height');
    if (typeof texture.generateMipmaps !== 'boolean') throw new Error(`Texture ${texture.uuid}: missing mip policy`);
    const layout = pixelLayout(texture);
    const data = Buffer.from(await readPayload(texture.sha256));
    if (data.length !== texture.sourceBytes || sha(data) !== texture.sha256) throw new Error(`Texture ${texture.uuid}: payload integrity failure`);
    const levels = texture.mipLevels;
    if (!Array.isArray(levels) || !levels.length) throw new Error(`Texture ${texture.uuid}: missing mip layout`);
    let end = 0;
    for (let i = 0; i < levels.length; i++) {
      const level = levels[i], width = Math.max(1, texture.width >> i), height = Math.max(1, texture.height >> i);
      if (level.width !== width || level.height !== height || level.byteOffset !== end || level.byteLength !== layout.bytes(width, height)) throw new Error(`Texture ${texture.uuid}: invalid mip ${i}`);
      end += level.byteLength;
    }
    if (end !== data.length) throw new Error(`Texture ${texture.uuid}: unaccounted payload bytes`);
    let gpuBytes = data.length;
    if (texture.generateMipmaps && levels.length === 1) {
      let w = texture.width, h = texture.height;
      while (w > 1 || h > 1) { w = Math.max(1, w >> 1); h = Math.max(1, h >> 1); gpuBytes += layout.bytes(w, h); }
    }
    if (gpuBytes > maxPageBytes) throw new Error(`Texture ${texture.uuid}: ${gpuBytes} GPU bytes exceed page cap; no implicit downsample`);
    const sampler = Object.fromEntries(samplerFields.map(key => [key, texture[key]]));
    const groupKey = JSON.stringify([texture.width, texture.height, texture.format, texture.type, sampler, levels.map(l => [l.width, l.height, l.byteLength])]);
    const identity = `${groupKey}:${texture.sha256}`;
    let image = seen.get(identity);
    if (!image) {
      image = { texture, sampler, data, levels, gpuBytes, descriptors: [] };
      seen.set(identity, image);
      const group = groups.get(groupKey) ?? []; group.push(image); groups.set(groupKey, group);
    }
    const descriptor = { ...texture, page: -1, layer: -1 };
    image.descriptors.push(descriptor); descriptors.push(descriptor);
  }
  const pages = [];
  for (const images of groups.values()) {
    let start = 0;
    while (start < images.length) {
      const first = images[start];
      const count = Math.min(maxLayers, Math.floor(maxPageBytes / first.gpuBytes), images.length - start);
      const batch = images.slice(start, start + count), chunks = [], mipLevels = [];
      let offset = 0;
      for (let mip = 0; mip < first.levels.length; mip++) {
        const level = first.levels[mip], byteLength = level.byteLength * count;
        mipLevels.push({ width: level.width, height: level.height, byteOffset: offset, byteLength, layerBytes: level.byteLength });
        for (const image of batch) chunks.push(image.data.subarray(image.levels[mip].byteOffset, image.levels[mip].byteOffset + image.levels[mip].byteLength));
        offset += byteLength;
      }
      const bytes = Buffer.concat(chunks), id = pages.length;
      const page = { id, sha256: sha(bytes), sourceBytes: bytes.length, gpuBytes: first.gpuBytes * count,
        width: first.texture.width, height: first.texture.height, layers: count, format: first.texture.format, type: first.texture.type,
        compressed: !!first.texture.compressed,
        ...(first.texture.compressed ? { compression: 'astc-4x4', blockWidth: 4, blockHeight: 4, blockBytes: 16, requiredFeature: 'texture-compression-astc', basis: first.texture.basis } : {}),
        sampler: first.sampler, mipLevels };
      await writePage(page, bytes);
      pages.push(page);
      batch.forEach((image, layer) => image.descriptors.forEach(descriptor => { descriptor.page = id; descriptor.layer = layer; }));
      start += count;
    }
  }
  return { version: 1, pages, textures: descriptors, gpuBytes: pages.reduce((sum, page) => sum + page.gpuBytes, 0),
    requiredFeatures: [...new Set(pages.flatMap(page => page.requiredFeature ? [page.requiredFeature] : []))] };
}
