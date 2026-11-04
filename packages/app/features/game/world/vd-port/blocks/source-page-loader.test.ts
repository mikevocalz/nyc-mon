import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import * as THREE from 'three/webgpu';
import { createMaterialPageBank } from './material-pages.ts';
import { sourceTextureBinding } from './source-textures.ts';
import { createSourcePageLoader, sourcePageId, type SourcePageSpec } from './source-page-loader.ts';
const hash = async (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const sampler = { colorSpace: THREE.NoColorSpace, wrapS: THREE.RepeatWrapping, wrapT: THREE.MirroredRepeatWrapping, flipY: false, premultiplyAlpha: false, unpackAlignment: 1, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, anisotropy: 8, generateMipmaps: false };
function page(bytes: Uint8Array, extra: Partial<SourcePageSpec> = {}): SourcePageSpec {
  return { id: 0, width: 2, height: 2, layers: 1, format: THREE.RGBAFormat, type: THREE.UnsignedByteType, sampler,
    sourceBytes: bytes.length, gpuBytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'),
    mipLevels: [{ width: 2, height: 2, byteOffset: 0, byteLength: 16, layerBytes: 16 }, { width: 1, height: 1, byteOffset: 16, byteLength: 4, layerBytes: 4 }], ...extra };
}
const bytes = Uint8Array.from({ length: 20 }, (_, i) => i + 1);
const controller = () => new AbortController();
function loader(p: SourcePageSpec, readPayload = async () => bytes) {
  return createSourcePageLoader(THREE, { namespace: 'pbr', manifest: { version: 1, pages: [p] }, readPayload, sha256Hex: hash });
}

test('RGBA source mip chain, sampler and GPU accounting are preserved exactly', async () => {
  const p = page(bytes), l = loader(p), result = await l.load(sourcePageId('pbr', p), controller().signal);
  assert.ok(result.texture instanceof THREE.DataTexture); assert.equal(result.bytes, 20);
  assert.deepEqual(result.texture.mipmaps.map(m => [...(m as { data: Uint8Array }).data]), [[...bytes.slice(0, 16)], [...bytes.slice(16)]]);
  for (const [key, value] of Object.entries(sampler)) assert.equal((result.texture as unknown as Record<string, unknown>)[key], value, key);
  let disposals = 0; result.texture.addEventListener('dispose', () => disposals++); result.dispose(); result.dispose(); assert.equal(disposals, 1);
});

test('R and RG pages retain both layers in layer-major order and generated mip byte budget', async () => {
  for (const [format, channels] of [[THREE.RedFormat, 1], [THREE.RGFormat, 2]] as const) {
    const data = Uint8Array.from({ length: 8 * channels }, (_, i) => i);
    const p = page(data, { format, layers: 2, gpuBytes: 10 * channels, sampler: { ...sampler, generateMipmaps: true },
      mipLevels: [{ width: 2, height: 2, byteOffset: 0, byteLength: data.length, layerBytes: 4 * channels }] });
    const result = await loader(p, async () => data).load(sourcePageId('pbr', p), controller().signal);
    assert.ok(result.texture instanceof THREE.DataArrayTexture); assert.equal(result.texture.image.depth, 2);
    assert.deepEqual(result.texture.image.data, data); assert.equal(result.texture.format, format); assert.equal(result.bytes, data.length + channels * 2);
    result.dispose();
  }
});

test('namespaces isolate local page IDs and manifest validation rejects corrupt layout/accounting', () => {
  const p = page(bytes); assert.notEqual(sourcePageId('global', p), sourcePageId('pbr', p));
  for (const broken of [ { gpuBytes: 21 }, { sourceBytes: 21 }, { type: THREE.FloatType }, { layers: 2 },
    { sampler: { ...sampler, generateMipmaps: true } },
    { sampler: { ...sampler, flipY: true } },
    { sampler: { ...sampler, premultiplyAlpha: true } },
    { mipLevels: [{ ...p.mipLevels[0]!, byteOffset: 1 }] },
    { mipLevels: [...p.mipLevels, p.mipLevels[1]!] } ]) assert.throws(() => loader({ ...p, ...broken }));
  assert.throws(() => createSourcePageLoader(THREE, { namespace: 'pbr', manifest: { version: 1, pages: [p, p] }, readPayload: async () => bytes, sha256Hex: hash }), /Duplicate/);
});

test('bad payload size/hash and cancelled pending reads fail before texture allocation', async () => {
  let created = 0; class Counted extends THREE.DataTexture { constructor(...args: ConstructorParameters<typeof THREE.DataTexture>) { super(...args); created++; } }
  const three = { ...THREE, DataTexture: Counted };
  const p = page(bytes), id = sourcePageId('pbr', p), c = controller();
  const make = (readPayload: () => Promise<Uint8Array>) => createSourcePageLoader(three, { namespace: 'pbr', manifest: { version: 1, pages: [p] }, readPayload, sha256Hex: hash });
  await assert.rejects(make(async () => bytes.slice(1)).load(id, c.signal), /size mismatch/);
  await assert.rejects(make(async () => bytes.map(v => v + 1)).load(id, c.signal), /hash mismatch/);
  let finish!: (bytes: Uint8Array) => void;
  const pending = make(() => new Promise(resolve => { finish = resolve; })).load(id, c.signal);
  c.abort(); finish(bytes); await assert.rejects(pending, { name: 'AbortError' }); assert.equal(created, 0);
});

test('partial construction failure disposes texture and verified payload cannot be mutated during hash await', async () => {
  let disposed = 0; class Broken extends THREE.DataTexture {
    override set needsUpdate(_: boolean) { throw new Error('native upload setter failed'); }
    override dispose() { disposed++; super.dispose(); }
  }
  const p = page(bytes), id = sourcePageId('pbr', p);
  const broken = createSourcePageLoader({ ...THREE, DataTexture: Broken }, { namespace: 'pbr', manifest: { version: 1, pages: [p] }, readPayload: async () => bytes, sha256Hex: hash });
  await assert.rejects(broken.load(id, controller().signal), /upload setter/); assert.equal(disposed, 1);
  const pooled = bytes.slice();
  const stable = createSourcePageLoader(THREE, { namespace: 'pbr', manifest: { version: 1, pages: [p] }, readPayload: async () => pooled,
    sha256Hex: async snapshot => { pooled.fill(255); return hash(snapshot); } });
  const result = await stable.load(id, controller().signal); assert.ok(result.texture instanceof THREE.DataTexture); assert.deepEqual(result.texture.image.data, bytes.slice(0, 16)); result.dispose();
});

test('installed WebGPU backend uploads each authored DataTexture mip at its exact level', async () => {
  const { installGpuGlobals, recordingCanvas, recordingGpuDevice } = await import('../../../render-runtime/recording-gpu.test-support.ts');
  installGpuGlobals(); const { device, record } = recordingGpuDevice();
  const uploads: { level: number; data: number[] }[] = [];
  const typedDevice = device as { queue: { writeTexture(target: { mipLevel?: number }, data: Uint8Array): void } };
  typedDevice.queue.writeTexture = (target: { mipLevel?: number }, data: Uint8Array) => { uploads.push({ level: target.mipLevel ?? 0, data: [...data] }); };
  const renderer = new THREE.WebGPURenderer({ canvas: recordingCanvas(16, 16), device } as never); await renderer.init();
  const p = page(bytes, { sampler: { ...sampler, flipY: false } });
  const loaded = await loader(p).load(sourcePageId('pbr', p), controller().signal);
  await renderer.initTexture(loaded.texture);
  assert.deepEqual(uploads, [{ level: 0, data: [...bytes.slice(0, 16)] }, { level: 1, data: [...bytes.slice(16)] }]);
  assert.ok(record.textures.some(t => t.width === 2 && t.height === 2 && t.mipLevelCount === 2));
  loaded.dispose(); renderer.dispose();
});

function astcPage(layers = 1) {
  let offset = 0;
  const mipLevels = [[8, 4], [4, 2], [2, 1], [1, 1]].map(([width, height]) => {
    const layerBytes = Math.ceil(width! / 4) * Math.ceil(height! / 4) * 16;
    const mip = { width: width!, height: height!, byteOffset: offset, byteLength: layerBytes * layers, layerBytes };
    offset += mip.byteLength; return mip;
  });
  const data = Uint8Array.from({ length: offset }, (_, i) => i % 251);
  const p = page(data, { width: 8, height: 4, layers, compressed: true, compression: 'astc-4x4', blockWidth: 4, blockHeight: 4, blockBytes: 16,
    requiredFeature: 'texture-compression-astc', format: THREE.RGBA_ASTC_4x4_Format, sampler: { ...sampler, colorSpace: THREE.SRGBColorSpace }, mipLevels });
  return { p, data };
}

test('ASTC rejects unsupported devices and malformed blocks without payload reads or an RGBA fallback', async () => {
  const { p, data } = astcPage(); let reads = 0;
  const make = (extra: Partial<SourcePageSpec> = {}, hasFeature?: (name: string) => boolean) => createSourcePageLoader(THREE, {
    namespace: 'astc', manifest: { version: 1, pages: [{ ...p, ...extra }] }, readPayload: async () => { reads++; return data; }, sha256Hex: hash, hasFeature });
  await assert.rejects(make().load(sourcePageId('astc', p), controller().signal), /enabled GPUDevice/);
  await assert.rejects(make({}, () => false).load(sourcePageId('astc', p), controller().signal), /enabled GPUDevice/);
  assert.equal(reads, 0);
  for (const bad of [{ format: THREE.RGBAFormat }, { blockBytes: 8 }, { blockWidth: 8 }, { requiredFeature: undefined },
    { sampler: { ...p.sampler, flipY: true } }, { sampler: { ...p.sampler, generateMipmaps: true } },
    { mipLevels: p.mipLevels.slice(0, -1) }, { mipLevels: [{ ...p.mipLevels[0]!, layerBytes: 31 }, ...p.mipLevels.slice(1)] }]) {
    assert.throws(() => make(bad as Partial<SourcePageSpec>, () => true));
  }
});

test('installed WebGPU ASTC path preserves every full mip and array layer with sRGB format and block-copy offsets', async () => {
  const { installGpuGlobals, recordingCanvas, recordingGpuDevice } = await import('../../../render-runtime/recording-gpu.test-support.ts');
  installGpuGlobals(); const { device, record } = recordingGpuDevice({ features: ['texture-compression-astc'] });
  const uploads: { level: number; layer: number; offset: number; row: number; data: number[] }[] = [];
  const formats: string[] = [];
  const gpu = device as { queue: { writeTexture(target: { mipLevel: number; origin: { z: number } }, data: Uint8Array, layout: { offset: number; bytesPerRow: number }): void }; createTexture(desc: { format: string }): unknown };
  const createTexture = gpu.createTexture.bind(gpu);
  gpu.createTexture = desc => { formats.push(desc.format); return createTexture(desc); };
  gpu.queue.writeTexture = (target, data, layout) => uploads.push({ level: target.mipLevel, layer: target.origin.z, offset: layout.offset, row: layout.bytesPerRow, data: [...data] });
  const renderer = new THREE.WebGPURenderer({ canvas: recordingCanvas(16, 16), device } as never); await renderer.init();
  for (const layers of [1, 2]) {
    uploads.length = 0;
    const { p, data } = astcPage(layers);
    const l = createSourcePageLoader(THREE, { namespace: 'astc', manifest: { version: 1, pages: [p] }, readPayload: async () => data, sha256Hex: hash,
      hasFeature: name => renderer.hasFeature(name) });
    const loaded = await l.load(sourcePageId('astc', p), controller().signal);
    assert.ok(loaded.texture instanceof THREE.CompressedTexture);
    assert.equal('isCompressedArrayTexture' in loaded.texture, layers > 1);
    assert.equal(loaded.bytes, data.length);
    await renderer.initTexture(loaded.texture);
    assert.equal(uploads.length, p.mipLevels.length * layers);
    for (let i = 0; i < p.mipLevels.length; i++) for (let layer = 0; layer < layers; layer++) {
      const m = p.mipLevels[i]!, upload = uploads[i * layers + layer]!;
      assert.deepEqual(upload, { level: i, layer, offset: layer * m.layerBytes, row: Math.ceil(m.width / 4) * 16,
        data: [...data.subarray(m.byteOffset, m.byteOffset + m.byteLength)] });
    }
    const binding = sourceTextureBinding(THREE, { source: { texture: loaded.texture, layer: THREE.TSL.float(layers - 1) } });
    const material = new THREE.MeshBasicNodeMaterial();
    material.colorNode = binding.sample('source', THREE.TSL.uv(), { dx: THREE.TSL.vec2(0.1, 0), dy: THREE.TSL.vec2(0, 0.1) }).xyz;
    const geometry = new THREE.PlaneGeometry(2, 2), scene = new THREE.Scene();
    scene.add(new THREE.Mesh(geometry, material));
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10); camera.position.z = 2;
    renderer.render(scene, camera);
    assert.ok(record.shaders.some(code => code.includes('textureSampleGrad')));
    if (layers > 1) assert.ok(record.shaders.some(code => code.includes('texture_2d_array<f32>')));
    geometry.dispose(); material.dispose(); loaded.dispose();
  }
  assert.ok(formats.includes('astc-4x4-unorm-srgb'));
  renderer.dispose();
});

test('lossless gzip transport verifies both identities and preserves exact decoded mips/sampler/budget',async()=>{
 const {gzipSync}=await import('three/examples/jsm/libs/fflate.module.js');const compressed=gzipSync(bytes,{mtime:0});
 const storedHash=await hash(compressed),p=page(bytes,{storage:{encoding:'gzip',sha256:storedHash,fileBytes:compressed.length,file:`${storedHash}.bin`}});
 const pooled=compressed.slice();let hashes=0;
 const l=createSourcePageLoader(THREE,{namespace:'gzip',manifest:{version:1,pages:[p]},readPayload:async()=>pooled,sha256Hex:async snapshot=>{hashes++;pooled.fill(0);return hash(snapshot);}});
 const result=await l.load(sourcePageId('gzip',p),controller().signal);
 assert.equal(hashes,2);assert.equal(result.bytes,p.gpuBytes);
 assert.deepEqual(result.texture.mipmaps.map(m=>[...(m as {data:Uint8Array}).data]),[[...bytes.slice(0,16)],[...bytes.slice(16)]]);
 assert.equal((result.texture.image as {data:Uint8Array}).data.buffer.byteLength,bytes.length+1,'fixed bounded output capacity');result.dispose();
});

test('gzip transport rejects stored hash, header/output size, decoded identity and metadata corruption before GPU allocation',async()=>{
 const {gzipSync}=await import('three/examples/jsm/libs/fflate.module.js');let created=0;
 class Counted extends THREE.DataTexture{constructor(...args:ConstructorParameters<typeof THREE.DataTexture>){super(...args);created++;}}
 const run=async(raw:Uint8Array,mutate?:(p:SourcePageSpec)=>void)=>{
  const sha=await hash(raw),p=page(bytes,{storage:{encoding:'gzip',sha256:sha,fileBytes:raw.length,file:`${sha}.bin`}});mutate?.(p);
  const l=createSourcePageLoader({...THREE,DataTexture:Counted},{namespace:'gzip',manifest:{version:1,pages:[p]},readPayload:async()=>raw,sha256Hex:hash});
  return l.load(sourcePageId('gzip',p),controller().signal);
 };
 const good=gzipSync(bytes,{mtime:0});
 await assert.rejects(run(good,p=>{p.storage!.sha256='00'.repeat(32);p.storage!.file=`${p.storage!.sha256}.bin`;}),/stored payload hash/);
 await assert.rejects(run(gzipSync(bytes.slice(1),{mtime:0})),/decoded size/);
 const overflow=gzipSync(new Uint8Array([...bytes,7,8]),{mtime:0});new DataView(overflow.buffer,overflow.byteOffset+overflow.length-4,4).setUint32(0,bytes.length,true);
 await assert.rejects(run(overflow),/decoded size/);
 await assert.rejects(run(gzipSync(bytes.map(v=>v+1),{mtime:0})),/payload hash mismatch/);
 const badHeader=good.slice();badHeader[3]=8;await assert.rejects(run(badHeader),/gzip header/);
 assert.throws(()=>loader(page(bytes,{storage:{encoding:'gzip',sha256:'00'.repeat(32),fileBytes:1,file:'../escape.bin'}})),/storage contract/);
 assert.equal(created,0);
});

test('abort after stored gzip authentication does not inflate/construct a late texture',async()=>{
 const {gzipSync}=await import('three/examples/jsm/libs/fflate.module.js');const raw=gzipSync(bytes,{mtime:0}),sha=await hash(raw),c=controller();let hashes=0;
 const p=page(bytes,{storage:{encoding:'gzip',sha256:sha,fileBytes:raw.length,file:`${sha}.bin`}});
 const l=createSourcePageLoader(THREE,{namespace:'gzip',manifest:{version:1,pages:[p]},readPayload:async()=>raw,sha256Hex:async snapshot=>{hashes++;c.abort();return hash(snapshot);}});
 await assert.rejects(l.load(sourcePageId('gzip',p),c.signal),{name:'AbortError'});assert.equal(hashes,1);
});


test('zero-lease eviction releases retained CPU pixels and reacquires an authenticated fresh texture', async () => {
  const first = page(bytes), second = page(bytes.map(v => v + 1), { id: 1 });
  let reads = 0, hashes = 0;
  const pages = createSourcePageLoader(THREE, { namespace: 'eviction', manifest: { version: 1, pages: [first, second] },
    readPayload: async p => { reads++; return p.id === 0 ? bytes : bytes.map(v => v + 1); },
    sha256Hex: async data => { hashes++; return hash(data); } });
  const bank = createMaterialPageBank({ limitBytes: 20, pages: pages.specs, load: pages.load });
  const id = sourcePageId('eviction', first), other = sourcePageId('eviction', second);
  const a = bank.lease([id]); assert.equal(await a.prefetch(), true);
  const retained = a.get(id).texture;
  assert.deepEqual((retained.image as {data: Uint8Array | null}).data, bytes.slice(0, 16));
  a.release(); // A cached, unleased page still owns its payload until actual eviction.
  assert.equal(retained.mipmaps.length, 2);
  const b = bank.lease([other]); assert.equal(await b.prefetch(), true);
  assert.equal((retained.image as {data: Uint8Array | null}).data, null); assert.deepEqual(retained.mipmaps, []);
  b.release();
  assert.equal(await a.prefetch(), true);
  assert.notEqual(a.get(id).texture, retained);
  assert.deepEqual((a.get(id).texture.image as {data: Uint8Array | null}).data, bytes.slice(0, 16));
  assert.equal(reads, 3); assert.equal(hashes, 3); assert.equal(bank.bytes, 20);
  a.release(); bank.dispose();
});


test('actual upload releases immutable CPU pixels, preserves mip layout and keeps a leased GPU page cached', async () => {
  const p=page(bytes);let reads=0;
  const pages=loader(p,async()=>{reads++;return bytes;});
  const bank=createMaterialPageBank({limitBytes:20,pages:pages.specs,load:pages.load});
  const id=sourcePageId('pbr',p),lease=bank.lease([id]);
  assert.equal(await lease.prefetch(),true);
  const texture=lease.get(id).texture,version=texture.version;
  assert.equal((texture.image as {data:Uint8Array}).data.byteLength,16,'pixels survive until the renderer reports its upload');
  texture.onUpdate!(texture);
  assert.equal((texture.image as {data:Uint8Array}).data.byteLength,0);
  assert.deepEqual(texture.mipmaps.map(m=>({width:m.width,height:m.height,bytes:(m as {data:Uint8Array}).data.byteLength})),[{width:2,height:2,bytes:0},{width:1,height:1,bytes:0}]);
  assert.equal(texture.version,version,'pixel release does not request a second upload');
  lease.release();assert.equal(await lease.prefetch(),true);
  assert.equal(lease.get(id).texture,texture);assert.equal(reads,1);
  lease.release();bank.dispose();
});

test('a real renderer upload releases page pixels and the next frame reuses its GPU texture without another write', async () => {
  const {installGpuGlobals,recordingCanvas,recordingGpuDevice}=await import('../../../render-runtime/recording-gpu.test-support.ts');
  installGpuGlobals();
  const {device:rawDevice}=recordingGpuDevice();const device=rawDevice as GPUDevice;let textureWrites=0;
  const write=device.queue.writeTexture.bind(device.queue);
  device.queue.writeTexture=(...args:Parameters<GPUQueue['writeTexture']>)=>{textureWrites++;write(...args);};
  const renderer=new THREE.WebGPURenderer({canvas:recordingCanvas(32,32),device} as never);
  await renderer.init();renderer.setSize(32,32,false);
  const p=page(bytes),pages=loader(p),owned=await pages.load(sourcePageId('pbr',p),controller().signal);
  const material=new THREE.MeshBasicNodeMaterial({map:owned.texture}),geometry=new THREE.PlaneGeometry(2,2);
  const scene=new THREE.Scene();scene.add(new THREE.Mesh(geometry,material));
  const camera=new THREE.PerspectiveCamera(50,1,.1,20);camera.position.z=3;
  try {
    renderer.render(scene,camera);
    assert.equal((owned.texture.image as {data:Uint8Array}).data.byteLength,0);
    assert.ok(textureWrites>0);const uploaded=textureWrites;
    renderer.render(scene,camera);
    assert.equal(textureWrites,uploaded,'an unchanged resident texture does not read its released CPU bytes');
  } finally {material.dispose();geometry.dispose();owned.dispose();await renderer.dispose();}
});
