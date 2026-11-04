import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { createSourcePbrGlassMaterial, classifySourcePbrGlass, SOURCE_PBR_GLASS_PROGRAMS, sourcePbrGlassParameterSchema, type SourcePbrGlassIdentity } from './source-glass-factory.ts';
import { sourceParameterBinding } from './source-bindings.ts';
import { createMaterialTable, packParameterRows } from './material-table.ts';
import type { SourceRenderState } from './source-standard.ts';
import { installGpuGlobals, recordingCanvas, recordingGpuDevice } from '../../../render-runtime/recording-gpu.test-support.ts';
const state: SourceRenderState = { fog: true, side: THREE.FrontSide, transparent: false, depthWrite: true, depthTest: true, colorWrite: true, blending: THREE.NormalBlending,
  blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: null, blendDstAlpha: null, blendEquation: THREE.AddEquation, blendEquationAlpha: null,
  premultipliedAlpha: false, alphaHash: false, alphaToCoverage: false, polygonOffset: false, polygonOffsetFactor: 0, polygonOffsetUnits: 0 };
function identity(key: keyof typeof SOURCE_PBR_GLASS_PROGRAMS): SourcePbrGlassIdentity {
  const program = SOURCE_PBR_GLASS_PROGRAMS[key]; return { key, shaderHash: program.hash, shaderSha256: program.sha256, type: 'MeshStandardMaterial', vertexColors: false, hasAlphaTest: false, mapRoles: [], attributeRoles: key.endsWith('|ca') ? ['aFkTr', 'aPgBody'] : [] };
}
const values = { diffuse: [0.4, 0.7, 0.8], emissive: [0, 0, 0], pgBody: [0.08, 0.06, 0.04], pgOrg: [2100, 0, -2900], pgRm: [3.7, 0, 7, 1.45],
  emissiveIntensity: 1, opacity: 0.25, roughness: 0.18, metalness: 0, envMapIntensity: 1, pgF0: 0.2, pgRough: 0.18, pgDirt: 0.3, pgStW: 30.5,
  pgBl: 0.85, pgTr: 0.6, pgSd: 3, pgShr: 0.2, pgGlow: 0.4, pgSlk: 1, pgLit: 0.4 };
function binding(source: SourcePbrGlassIdentity) {
  const T = THREE.TSL, schema = sourcePbrGlassParameterSchema(source);
  const table = createMaterialTable(THREE, packParameterRows('glass-material', schema.material, [values]));
  const row = T.varying(T.attribute('aVdSurface', 'vec4').x).setInterpolation('flat');
  const material = sourceParameterBinding(table, schema.material, row);
  const variants = schema.variant.length ? createMaterialTable(THREE, packParameterRows('glass-variant', schema.variant, [{ fkTr: [0.9, 0.8, 0.7], pgBody: [-1, -1, -1, -1] }])) : null;
  const variant = variants ? sourceParameterBinding(variants, schema.variant, row) : { scalar: () => { throw new Error('no variant'); }, vec2: () => { throw new Error('no variant'); }, vec3: () => { throw new Error('no variant'); }, vec4: () => { throw new Error('no variant'); } };
  return { table, variants, material, variant };
}

test('six actual PBR-glass identities reject unknown programs, source maps, and absent tint/body attributes', () => {
  for (const key of Object.keys(SOURCE_PBR_GLASS_PROGRAMS) as (keyof typeof SOURCE_PBR_GLASS_PROGRAMS)[]) assert.equal(classifySourcePbrGlass(identity(key)).program, key);
  assert.throws(() => classifySourcePbrGlass({ ...identity('pbrglass4|o'), shaderSha256: '0'.repeat(64) }), /Unverified/);
  assert.throws(() => classifySourcePbrGlass({ ...identity('pbrglass4|o'), key: 'pbrglass4|t|rm' }), /Unverified/);
  assert.throws(() => classifySourcePbrGlass({ ...identity('pbrglass4|o|st|ca'), attributeRoles: ['aFkTr'] }), /attribute/);
  assert.throws(() => classifySourcePbrGlass({ ...identity('pbrglass4|o'), mapRoles: ['map'] }), /map/);
});

test('all six actual glass factories bind full pg tables, source-frame patterns and premultiplied output branches', async () => {
  installGpuGlobals(); const { device, record } = recordingGpuDevice(); const renderer = new THREE.WebGPURenderer({ canvas: recordingCanvas(32, 32), device } as never); await renderer.init();
  const T = THREE.TSL, night = T.uniform(0), scene = new THREE.Scene(), geometry = new THREE.PlaneGeometry();
  geometry.setAttribute('aVdSurface', new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position!.count * 4), 4));
  const materials = [], owned = [];
  for (const key of Object.keys(SOURCE_PBR_GLASS_PROGRAMS) as (keyof typeof SOURCE_PBR_GLASS_PROGRAMS)[]) {
    const source = identity(key), flags = classifySourcePbrGlass(source), b = binding(source); owned.push(b);
    const mat = createSourcePbrGlassMaterial(THREE, { ...b, name: key, source,
      state: flags.opaque ? state : { ...state, transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor },
      frame: { position: T.positionWorld.add(T.vec3(2100, 0, -2900)), cameraPosition: T.cameraPosition.add(T.vec3(2100, 0, -2900)), normal: T.normalWorld },
      geometricNormal: T.normalize(T.cross(T.dFdx(T.positionView), T.dFdy(T.positionView))),
      environment: { night, reflectionGain: T.float(1), sunDirection: T.normalize(T.vec3(-0.5, 0.7, 0.3)), sunColor: T.vec3(1, 0.93, 0.82), zenith: T.vec3(0.12, 0.3, 0.7), horizon: T.vec3(0.78, 0.83, 0.9) },
      ground: { sample: T.vec4(0.8, 0.03, 0, 0), rect: T.vec4(0, 0, 1, 1) },
    });
    assert.equal(mat.premultipliedAlpha, false, 'authored hook premultiplies once');
    assert.equal(mat.transparent, !flags.opaque); materials.push(mat); scene.add(new THREE.Mesh(geometry, mat));
  }
  scene.add(new THREE.HemisphereLight()); const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100); camera.position.z = 3; renderer.render(scene, camera);
  assert.ok(record.shaders.some(s => s.includes('textureLoad')), 'actual parameter/variant tables bind');
  assert.ok(record.shaders.some(s => s.includes('dpdx')), 'frame derivative and room/reflection patterns compile');
  const count = record.renderPipelines; night.value = 0.92; renderer.render(scene, camera); assert.equal(record.renderPipelines, count);
  for (const mat of materials) mat.dispose(); for (const b of owned) { b.table.dispose(); b.variants?.dispose(); } geometry.dispose(); renderer.dispose();
});

test('missing authored pg parameters and incorrect transparent blend state fail before publication', () => {
  const T = THREE.TSL, source = identity('pbrglass4|t|st'), b = binding(source);
  const input = { ...b, name: 'bad', source, state, frame: { position: T.positionWorld, cameraPosition: T.cameraPosition, normal: T.normalWorld }, geometricNormal: T.normalWorld,
    environment: { night: T.float(0), reflectionGain: T.float(1), sunDirection: T.vec3(0, 1, 0), sunColor: T.vec3(1), zenith: T.vec3(0.1), horizon: T.vec3(0.8) }, ground: { sample: T.vec4(0), rect: T.vec4(0) } };
  assert.throws(() => createSourcePbrGlassMaterial(THREE, input), /blend/);
  assert.throws(() => createSourcePbrGlassMaterial(THREE, { ...input, source: identity('pbrglass4|o'), material: { ...b.material, scalar: () => { throw new Error('missing pgF0'); } } }), /pgF0/);
  b.table.dispose(); b.variants?.dispose();
});
