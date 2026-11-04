// Use the repository-pinned Three Basis transcoder, as bake-pbr.mjs does.
// Unlike the furniture bake, retain original dimensions, RGBA channels and every mip.
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';

export function sourcePbrTexture(image, set, role, sourceKtxSha256) {
  if (!['albedo', 'normal', 'orm'].includes(role)) throw new Error(`Unknown source PBR role: ${role}`);
  if (image.transfer !== (role === 'albedo' ? 2 : 1)) throw new Error(`${set}/${role}: source transfer contradicts texture role`);
  return {
    uuid: `pbr:${set}:${role}`, set, role, sourceKtxSha256,
    width: image.width, height: image.height, format: 1023, type: 1009, compressed: false,
    sha256: createHash('sha256').update(image.bytes).digest('hex'), sourceBytes: image.bytes.length,
    mipLevels: image.mipLevels, generateMipmaps: false, colorSpace: role === 'albedo' ? 'srgb' : '',
    wrapS: 1000, wrapT: 1000, flipY: false, premultiplyAlpha: false, unpackAlignment: 4,
    minFilter: 1008, magFilter: 1006, anisotropy: role === 'albedo' ? 16 : 8,
    repeat: [1, 1], offset: [0, 0], center: [0, 0], rotation: 0, channel: 0,
    matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  };
}

export async function createSourceKtxDecoder(basisDir) {
  const filename = join(basisDir, 'basis_transcoder.js'), module = { exports: {} };
  const javascript = await readFile(filename, 'utf8');
  vm.runInThisContext(`(function(module,exports,require,__filename,__dirname){${javascript}\n})`, { filename })(
    module, module.exports, createRequire(import.meta.url), filename, basisDir,
  );
  const basis = await module.exports({ wasmBinary: await readFile(join(basisDir, 'basis_transcoder.wasm')) });
  basis.initializeBasis();
  return function decodeSourceKtx(bytes, name) {
    const buffer = Buffer.from(bytes), file = new basis.KTX2File(new Uint8Array(buffer));
    try {
      if (!file.isValid()) throw new Error(`${name}: invalid KTX2`);
      if ((file.getLayers() || 1) !== 1 || file.getFaces() !== 1) throw new Error(`${name}: expected a single 2D source image`);
      if (!file.startTranscoding()) throw new Error(`${name}: failed to start source transcode`);
      const chunks = [], mipLevels = [];
      let offset = 0;
      for (let level = 0; level < file.getLevels(); level++) {
        const info = file.getImageLevelInfo(level, 0, 0);
        const data = new Uint8Array(file.getImageTranscodedSizeInBytes(level, 0, 0, 13)); // Basis RGBA32
        if (!file.transcodeImage(data, level, 0, 0, 13, 0, -1, -1)) throw new Error(`${name}: source mip ${level} transcode failed`);
        if (data.length !== info.origWidth * info.origHeight * 4) throw new Error(`${name}: unexpected source mip layout`);
        chunks.push(data); mipLevels.push({ width: info.origWidth, height: info.origHeight, byteOffset: offset, byteLength: data.length });
        offset += data.length;
      }
      const transfer = buffer[buffer.readUInt32LE(48) + 14];
      if (transfer !== 1 && transfer !== 2) throw new Error(`${name}: unsupported source transfer ${transfer}`);
      return { width: file.getWidth(), height: file.getHeight(), transfer, bytes: Buffer.concat(chunks), mipLevels };
    } finally { file.close(); file.delete(); }
  };
}
