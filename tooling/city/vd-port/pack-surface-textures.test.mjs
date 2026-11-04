import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { packSurfaceTextures } from './pack-surface-textures.mjs';

const payloads = new Map();
function texture(uuid, data, options = {}) {
  const bytes = Buffer.from(data), sha256 = createHash('sha256').update(bytes).digest('hex'); payloads.set(sha256, bytes);
  return { uuid, width: 2, height: 2, format: 1023, type: 1009, compressed: false,
    sourceBytes: bytes.length, sha256, generateMipmaps: true, colorSpace: 'srgb', wrapS: 1001, wrapT: 1001,
    flipY: true, premultiplyAlpha: false, unpackAlignment: 4, minFilter: 1008, magFilter: 1006, anisotropy: 8,
    repeat: [2, 3], offset: [0.1, 0.2], center: [0, 0], rotation: 0.7, channel: 0,
    mipLevels: [{ width: 2, height: 2, byteOffset: 0, byteLength: 16 }], ...options };
}
function pack(textures, overrides = {}) {
  const written = [];
  return packSurfaceTextures(textures, { maxPageBytes: 100, maxLayers: 8,
    readPayload: hash => payloads.get(hash), writePage: (page, bytes) => written.push({ page, bytes }), ...overrides }).then(result => ({ result, written }));
}

test('strong content dedup preserves per-reference transforms, native channels, source size and mip residency', async () => {
  const first = texture('a', Array.from({ length: 16 }, (_, i) => i));
  const duplicate = { ...first, uuid: 'b', repeat: [1, 1], rotation: -0.2 };
  const red = texture('mask', [10, 20, 30, 40], { format: 1028, sourceBytes: 4,
    mipLevels: [{ width: 2, height: 2, byteOffset: 0, byteLength: 4 }] });
  const { result, written } = await pack([first, duplicate, red]);
  assert.equal(result.pages.length, 2);
  assert.equal(result.textures[0].page, result.textures[1].page);
  assert.deepEqual(result.textures[0].repeat, [2, 3]); assert.deepEqual(result.textures[1].repeat, [1, 1]);
  assert.equal(result.gpuBytes, 20 + 5, 'RGBA8 and R8 keep their full chains without RGBA expansion');
  assert.deepEqual(written[0].bytes, payloads.get(first.sha256));
  assert.deepEqual(written[1].bytes, payloads.get(red.sha256));
});

test('array pages retain every explicit mip and split by GPU byte cap or sampler state', async () => {
  const options = { generateMipmaps: false, mipLevels: [
    { width: 2, height: 2, byteOffset: 0, byteLength: 16 }, { width: 1, height: 1, byteOffset: 16, byteLength: 4 },
  ] };
  const a = texture('a', Array.from({ length: 20 }, (_, i) => i), options);
  const b = texture('b', Array.from({ length: 20 }, (_, i) => i + 30), options);
  const { result, written } = await pack([a, b], { maxPageBytes: 40 });
  assert.equal(result.pages[0].layers, 2);
  assert.deepEqual(written[0].bytes, Buffer.concat([payloads.get(a.sha256).subarray(0, 16), payloads.get(b.sha256).subarray(0, 16), payloads.get(a.sha256).subarray(16), payloads.get(b.sha256).subarray(16)]));
  assert.equal((await pack([a, b], { maxPageBytes: 20 })).result.pages.length, 2);
  assert.equal((await pack([a, { ...a, uuid: 'other-sampler', wrapS: 1000 }])).result.pages.length, 2);
});

test('corruption, unknown formats, missing mip policy and oversized images fail instead of changing authored assets', async () => {
  const a = texture('a', new Uint8Array(16));
  await assert.rejects(pack([a], { readPayload: () => Buffer.alloc(16, 3) }), /integrity/);
  await assert.rejects(pack([{ ...a, format: 9999 }]), /unsupported/);
  await assert.rejects(pack([{ ...a, generateMipmaps: undefined }]), /mip policy/);
  await assert.rejects(pack([a], { maxPageBytes: 19 }), /no implicit downsample/);
});

test('ASTC4x4 pages preserve explicit small-block mips, layers, samplers and capability requirements',async()=>{
 const mips=[{width:8,height:4,byteOffset:0,byteLength:32},{width:4,height:2,byteOffset:32,byteLength:16},{width:2,height:1,byteOffset:48,byteLength:16},{width:1,height:1,byteOffset:64,byteLength:16}];
 const options={width:8,height:4,format:37808,compressed:true,compression:'astc-4x4',basis:{jsSha256:'a'.repeat(64),wasmSha256:'b'.repeat(64)},requiredFeature:'texture-compression-astc',generateMipmaps:false,flipY:false,mipLevels:mips};
 const a=texture('a',Array.from({length:80},(_,i)=>i),options),b=texture('b',Array.from({length:80},(_,i)=>i+100),options);
 const{result,written}=await pack([a,b],{maxPageBytes:160});
 assert.equal(result.pages.length,1);assert.equal(result.pages[0].layers,2);assert.equal(result.gpuBytes,160);
 assert.equal(result.pages[0].format,37808);assert.equal(result.pages[0].compressed,true);assert.deepEqual(result.requiredFeatures,['texture-compression-astc']);
 assert.deepEqual(result.pages[0].mipLevels.map(m=>m.layerBytes),[32,16,16,16]);
 assert.deepEqual(written[0].bytes,Buffer.concat(mips.flatMap(mip=>[payloads.get(a.sha256).subarray(mip.byteOffset,mip.byteOffset+mip.byteLength),payloads.get(b.sha256).subarray(mip.byteOffset,mip.byteOffset+mip.byteLength)])));
 await assert.rejects(pack([{...a,generateMipmaps:true}]),/original explicit mips/);
 await assert.rejects(pack([{...a,requiredFeature:undefined}]),/unsupported compressed/);
 await assert.rejects(pack([{...a,mipLevels:[...mips.slice(0,3),{...mips[3],byteLength:4}]}]),/invalid mip/);
});
