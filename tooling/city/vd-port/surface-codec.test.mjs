import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MeshoptEncoder, MeshoptDecoder } from '../../../node_modules/.pnpm/meshoptimizer@1.1.1/node_modules/meshoptimizer/index.js';
import { encodeSurfaceCell } from './surface-codec.mjs';
import { floatToHalf, halfToFloat, octEncode, octDecode, transformSurfaceNormal } from './surface-layout.mjs';
import { harvestSurfaceTriangles, GVC_ZERO_NORMAL_REPAIR_SHADER, METAL_VC_ZERO_NORMAL_REPAIR_SHADER, SIGN_KIT_NORMAL_REPAIR_SOURCE } from './surface-harvest.mjs';
import { partitionSurfaceCells } from './write-surfaces.mjs';

const registry = { sha256: 'a1'.repeat(32), materialCount: 4, variantCount: 8 };
const vertex = (over = {}) => ({ position: [1, 400, 1], color: [2.446552276611328, 0.005842364393174648, 1], uv: [0.12345679104328156, 1.25], normal: [0.3, 0.4, 0.5], material: 2, variant: 5, grime: 1.335714340209961, flags: 63, weather: [958, 390, 420, -1], ...over });
const vertices = () => [vertex(), vertex({ position: [2, 400, 1] }), vertex({ position: [1, 401, 1] })];

test('VDN3 actual meshopt payload preserves HALF HDR, UV and registry layout', async () => {
  const encoded = await encodeSurfaceCell({ cx: 0, cz: 0, vertices: vertices(), indices: [0, 1, 2], registry, encoder: MeshoptEncoder });
  assert.equal(Buffer.from(encoded.bytes.subarray(0, 4)).toString(), 'VDN3');
  const header = new DataView(encoded.bytes.buffer);
  assert.equal(header.getUint16(20, true), 1); assert.equal(header.getUint16(22, true), 52);
  assert.equal(Buffer.from(encoded.bytes.subarray(24, 56)).toString('hex'), registry.sha256);
  const decoded = new Uint8Array(3 * 52);
  await MeshoptDecoder.ready;
  MeshoptDecoder.decodeVertexBuffer(decoded, 3, 52, encoded.bytes.subarray(64, 64 + (header.getUint32(12, true) & 0x7fffffff)));
  assert.deepEqual(decoded, encoded.vertexBytes);
  const v = new DataView(decoded.buffer);
  assert.ok(Math.abs(halfToFloat(v.getUint16(8, true)) - vertices()[0].color[0]) <= 0.002);
  assert.ok(Math.abs(halfToFloat(v.getUint16(30, true)) - vertices()[0].grime) <= 0.001);
  assert.equal(v.getFloat32(16, true), vertices()[0].uv[0]);
  assert.equal(v.getUint16(14, true), 63); assert.equal(v.getUint16(28, true), 2); assert.equal(v.getUint32(32, true), 5);
  assert.equal(v.getFloat32(48, true), -1);
});

test('surface quantization rejects nonfinite/overflow and bounds octahedral normal angle', () => {
  assert.equal(floatToHalf(1), 0x3c00); assert.equal(floatToHalf(-2), 0xc000);
  assert.equal(halfToFloat(1), 2 ** -24);
  assert.throws(() => floatToHalf(Infinity), /finite/); assert.throws(() => floatToHalf(65505), /range/);
  let maxAngle = 0;
  for (let i = 0; i < 2000; i++) {
    const n = [Math.sin(i * 7.13), Math.cos(i * 2.97), Math.sin(i * 0.77 + 1)];
    const length = Math.hypot(...n), unit = n.map(v => v / length), decoded = octDecode(octEncode(unit));
    const dot = unit.reduce((sum, v, c) => sum + v * decoded[c], 0);
    maxAngle = Math.max(maxAngle, Math.acos(Math.min(1, Math.max(-1, dot))) * 180 / Math.PI);
  }
  assert.ok(maxAngle < 0.01, `normal angular error ${maxAngle} degrees`);
});

test('writer rejects material/variant seams and malformed finite channels', async () => {
  const encode = over => encodeSurfaceCell({ cx: 0, cz: 0, vertices: vertices(), indices: [0, 1, 2], registry, encoder: MeshoptEncoder, ...over });
  await assert.rejects(encode({ vertices: [vertex(), vertex({ material: 1 }), vertex()] }), /seam/);
  await assert.rejects(encode({ vertices: [vertex(), vertex({ variant: 1 }), vertex()] }), /seam/);
  await assert.rejects(encode({ vertices: [vertex({ uv: [1e40, 0] }), vertex(), vertex()] }), /UV/);
  await assert.rejects(encode({ vertices: [vertex({ grime: 70000 }), vertex(), vertex()] }), /range/);
});

const attr = (values, itemSize) => ({ itemSize, count: values.length / itemSize, getComponent: (i, c) => values[i * itemSize + c], getX: i => values[i * itemSize] });
const matrix = elements => ({ elements, clone() { return matrix([...this.elements]); }, multiplyMatrices(a, b) {
  const result = Array(16).fill(0);
  for (let col = 0; col < 4; col++) for (let row = 0; row < 4; row++) for (let k = 0; k < 4; k++) result[col * 4 + row] += a.elements[k * 4 + row] * b.elements[col * 4 + k];
  this.elements = result; return this;
} });
const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function mesh() {
  return { isMesh: true, visible: true, renderOrder: 0, children: [], updateMatrixWorld() {}, matrixWorld: matrix(identity),
    material: { visible: true, transparent: true, opacity: 0.16 },
    geometry: { groups: [], index: null, drawRange: { start: 0, count: Infinity }, attributes: {
      position: attr([1, 2, 1, 2, 2, 1, 1, 3, 1], 3), normal: attr([0, 0, 1, 0, 0, 1, 0, 0, 1], 3),
      uv: attr([0, 0, 1, 0, 0, 1], 2), color: attr([2.446, 1, 1, 2.446, 1, 1, 2.446, 1, 1], 3),
      aFkTr: attr([1, 2, 3, 1, 2, 3, 1, 2, 3], 3), aGrime: attr([0, 1.3357, 1], 1),
      aWeather: attr([958, 0, 4, -1, 958, 0, 4, -1, 958, 0, 4, -1], 4),
    } } };
}
test('harvest retains low-opacity authored faces, raw HDR color and exact auxiliary seams', () => {
  let auxiliary;
  const surface = harvestSurfaceTriangles(mesh(), { material: () => ({ material: 2, family: 3 }), variant: (_material, attrs) => { auxiliary = attrs; return 5; } });
  assert.equal(surface.indices.length, 3);
  assert.equal(surface.vertices[0].color[0], 2.446); assert.equal(surface.vertices[1].grime, 1.3357);
  assert.deepEqual(auxiliary.aFkTr, [1, 2, 3]); assert.deepEqual(surface.families, [3, 3, 3]);
  const bad = mesh(); bad.geometry.attributes.aFkTr = attr([1, 2, 3, 2, 2, 3, 1, 2, 3], 3);
  assert.throws(() => harvestSurfaceTriangles(bad, { material: () => ({ material: 2, family: 3 }), variant: () => 5 }), /varies inside a triangle/);
});
test('nonuniform/mirrored transforms and family partition preserve source frame, UV seams and global coordinates', () => {
  const transformed = transformSurfaceNormal([1, 1, 1], [2, 0, 0, 0, 0, 3, 0, 0, 0, 0, 4, 0, 0, 0, 0, 1]);
  const expected = [0.5, 1 / 3, 0.25], length = Math.hypot(...expected);
  transformed.forEach((v, i) => assert.ok(Math.abs(v - expected[i] / length) < 1e-12));
  const source = mesh(); source.matrixWorld = matrix([-2, 0, 0, 0, 0, 3, 0, 0, 0, 0, 4, 0, 0, 0, 0, 1]);
  const surface = harvestSurfaceTriangles(source, { material: () => ({ material: 2, family: 3 }), variant: () => 5 });
  assert.deepEqual(surface.vertices[1].uv, [0, 1], 'negative determinant reverses winding');
  const frames = [];
  const cells = partitionSurfaceCells([{ id: 'fixture', base: 2, surface }], { affine: { sx: 2, ox: 100, sz: 3, oz: -200 }, withSourceFrame: (variant, frame) => { frames.push(frame); return variant; } });
  assert.equal(cells.length, 1); assert.match(cells[0].key, /-f3$/);
  assert.deepEqual(cells[0].vertices[0].position, [96, 4.14, -188]);
  assert.equal(frames[0].baseY, 2); assert.deepEqual(cells[0].vertices[1].uv, [0, 1]);
});

test('instanced harvesting retains original local frame and semantic instance color independently', () => {
  const source = mesh(); source.isInstancedMesh = true; source.count = 2;
  source.instanceColor = attr([.2, .3, .4, .8, .9, 1], 3);
  source.getMatrixAt = (instance, target) => { target.elements = [...identity]; target.elements[0] = 2; target.elements[12] = 10 + instance * 20; target.elements[14] = 7; };
  const variants = [];
  const surface = harvestSurfaceTriangles(source, { material: () => ({ material: 2, family: 3 }),
    variant: (_material, fields, frame) => { variants.push({ fields, frame }); return variants.length - 1; } });
  assert.equal(surface.vertices.length, 6);
  assert.deepEqual(surface.vertices[0].position, [12, 2, 8]);
  assert.deepEqual(surface.vertices[3].position, [32, 2, 8]);
  assert.deepEqual(variants[0].frame.instanceTranslationXZ, [10, 7]);
  assert.deepEqual(variants[1].frame.instanceTranslationXZ, [30, 7]);
  assert.deepEqual(variants[0].fields.instanceColor, [.2, .3, .4]);
  assert.deepEqual(surface.vertices[0].color, [2.446, 1, 1], 'semantic vertex RGB is not premultiplied by instance color');
});

test('only exact zero-area source triangles are omitted; nondegenerate zero normals fail',()=>{
  const registry={material:()=>({material:2,family:3}),variant:()=>5};
  const degenerate=mesh();degenerate.geometry.attributes.position=attr([0,0,0,1,0,0,2,0,0],3);degenerate.geometry.attributes.normal=attr(Array(9).fill(0),3);
  const omitted=harvestSurfaceTriangles(degenerate,registry);
  assert.equal(omitted.omittedZeroAreaTriangles,1);assert.equal(omitted.indices.length,0);
  const invalid=mesh();invalid.geometry.attributes.normal=attr(Array(9).fill(0),3);
  assert.throws(()=>harvestSurfaceTriangles(invalid,registry),/invalid transformed normal.*trianglePositions/);
  const tiny=mesh();tiny.geometry.attributes.position=attr([0,0,0,1e-20,0,0,0,1e-20,0],3);
  const retained=harvestSurfaceTriangles(tiny,registry);
  assert.equal(retained.omittedZeroAreaTriangles,0);assert.equal(retained.indices.length,3);
});

test('verified Gvc cleanup derives source winding normal through nonuniform mirrored transforms',()=>{
  const source=mesh();source.name='authored-glow';source.material.type='MeshStandardMaterial';source.material.name='ar33sign:glowvc';
  source.geometry.attributes.position=attr([0,0,0,1,1,0,0,1,1],3);
  source.geometry.attributes.normal=attr(Array(9).fill(0),3);
  source.matrixWorld=matrix([-2,0,0,0,0,3,0,0,0,0,4,0,10,20,30,1]);
  const registry={material:()=>({material:2,family:3}),variant:()=>5,sourceShaderSha256:()=>GVC_ZERO_NORMAL_REPAIR_SHADER};
  const surface=harvestSurfaceTriangles(source,registry);
  assert.deepEqual(surface.vertices.map(v=>v.position),[[10,20,30],[10,23,34],[8,23,30]]);
  assert.deepEqual(surface.vertices.map(v=>v.uv),[[0,0],[0,1],[1,0]]);
  assert.deepEqual(surface.vertices[0].color,[2.446,1,1]);
  const expected=transformSurfaceNormal([1,-1,1],source.matrixWorld.elements);
  for(const vertex of surface.vertices)vertex.normal.forEach((value,i)=>assert.ok(Math.abs(value-expected[i])<1e-12));
  assert.equal(surface.normalRepairs.length,1);assert.deepEqual(surface.normalRepairs[0].sourceCross,[1,-1,1]);
  assert.equal(surface.normalRepairs[0].shaderSha256,GVC_ZERO_NORMAL_REPAIR_SHADER);
  assert.throws(()=>harvestSurfaceTriangles(source,{...registry,sourceShaderSha256:()=> 'f'.repeat(64)}),/invalid transformed normal/);
  source.geometry.attributes.normal=attr([0,0,0,0,0,1,0,0,1],3);
  assert.throws(()=>harvestSurfaceTriangles(source,registry),/invalid transformed normal/);
});

test('active weather remains exact per-triangle flat data while grime may interpolate',async()=>{
 const source=mesh();source.geometry.attributes.aWeather=attr([1,0,4,-1,2,0,4,-1,1,0,4,-1],4);
 assert.throws(()=>harvestSurfaceTriangles(source,{material:()=>({material:2,family:3}),variant:()=>5}),/weather varies inside a triangle/);
 const invalid=vertices();invalid[1].weather=[959,390,420,-1];
 await assert.rejects(encodeSurfaceCell({cx:0,cz:0,vertices:invalid,indices:[0,1,2],registry,encoder:MeshoptEncoder}),/flat weather/);
 const valid=vertices();valid[1].grime=.25;valid[2].grime=1.1;
 await assert.doesNotReject(encodeSurfaceCell({cx:0,cz:0,vertices:valid,indices:[0,1,2],registry,encoder:MeshoptEncoder}));
});

test('MetalVC cleanup requires its exact named shader and pinned source closure',()=>{
 const source=mesh();source.material.type='MeshStandardMaterial';source.material.name='ar33sign:metalvc';source.geometry.attributes.normal=attr(Array(9).fill(0),3);
 const registry={material:()=>({material:2,family:3}),variant:()=>5,sourceShaderSha256:()=>METAL_VC_ZERO_NORMAL_REPAIR_SHADER,sourceSignKitSha256:SIGN_KIT_NORMAL_REPAIR_SOURCE};
 const fixed=harvestSurfaceTriangles(source,registry);assert.equal(fixed.normalRepairs.length,1);assert.equal(fixed.normalRepairs[0].meshPath,'root');assert.equal(fixed.normalRepairs[0].sourceClosureSha256,SIGN_KIT_NORMAL_REPAIR_SOURCE);
 assert.deepEqual(fixed.vertices.map(vertex=>vertex.position),[[1,2,1],[2,2,1],[1,3,1]]);
 assert.throws(()=>harvestSurfaceTriangles(source,{...registry,sourceSignKitSha256:'0'.repeat(64)}),/invalid transformed normal/);
 source.material.name='some-other-standard';assert.throws(()=>harvestSurfaceTriangles(source,registry),/invalid transformed normal/);
});
