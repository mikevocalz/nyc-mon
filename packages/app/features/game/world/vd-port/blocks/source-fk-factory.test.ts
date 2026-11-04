import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { createPilotFkMaterial, classifyPilotFk, PILOT_FK_PROGRAMS, SOURCE_FK_EXTRA_PROGRAMS, SOURCE_KIT_GLASS_EXTRA, type PilotFkSource } from './source-fk-factory.ts';
import { sourceParameterBinding, type SourceTextureBinding } from './source-bindings.ts';
import { createMaterialTable, packParameterRows, type ParameterField } from './material-table.ts';
import { sourceEnvironmentNodes } from './source-environment.ts';
import type { SourceRenderState } from './source-standard.ts';
import { installGpuGlobals, recordingCanvas, recordingGpuDevice } from '../../../render-runtime/recording-gpu.test-support.ts';

const prefix = 'onBeforeCompile( /* shaderobject, renderer */ ) {}|lighttrim1,1,1|st34|cityaon|cs34';
const keys: Record<string, string> = {
  '230396d1': `${prefix}|fkin0.6,0.85|fknight1`, '1c3d9b8b': `${prefix}|fkin0.6,0.85`,
  '62271fdd': `${prefix}|fknight1`, '692f9967': `${prefix}|fkin0.28,0.6`, 'ef4466c1': `${prefix}|fkin0.3,0.6|fknight1`,
  d1ec3ffd: `${prefix}p|fkplain|pbcity`, '289985f3': `${prefix}p|fkenvU|fkplain|pbcity`, d1d6ce16: 'kitwinglass3|0.2|0.03|0.3|0.26',
};
function source(hash: keyof typeof PILOT_FK_PROGRAMS): PilotFkSource {
  return { key: keys[hash]!, shaderHash: hash, shaderSha256: PILOT_FK_PROGRAMS[hash], type: 'MeshStandardMaterial', vertexColors: hash !== 'd1ec3ffd' && hash !== '289985f3', hasAlphaTest: false, mapRoles: [] };
}
const state: SourceRenderState = { fog: true, side: THREE.FrontSide, transparent: false, depthWrite: true, depthTest: true, colorWrite: true,
  blending: THREE.NormalBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: null, blendDstAlpha: null,
  blendEquation: THREE.AddEquation, blendEquationAlpha: null, premultipliedAlpha: false, alphaHash: false, alphaToCoverage: false,
  polygonOffset: false, polygonOffsetFactor: 0, polygonOffsetUnits: 0 };
const fields: ParameterField[] = [ { name: 'diffuse', size: 3 }, { name: 'emissive', size: 3 }, { name: 'fkLv', size: 2 },
  ...['emissiveIntensity', 'opacity', 'roughness', 'metalness', 'envMapIntensity', 'fkEnvK'].map(name => ({ name, size: 1 as const })) ];
function fixture() {
  const T = THREE.TSL, night = T.uniform(0), env = sourceEnvironmentNodes(THREE, night);
  const table = createMaterialTable(THREE, packParameterRows('pilot-materials', fields, [{ fkLv: [0.2, 1.1], diffuse: [0.7758222, 0.838799, 0.8227857], emissive: [1, 0.76, 0.48], emissiveIntensity: 0.4, opacity: 0.36, roughness: 0.03, metalness: 0, envMapIntensity: 1, fkEnvK: 0.3 }]));
  const variants = createMaterialTable(THREE, packParameterRows('pilot-variants', [{ name: 'fkTr', size: 3 }], [{ fkTr: [0.9, 0.8, 0.7] }]));
  const row = T.varying(T.attribute('aVdSurface', 'vec4').x).setInterpolation('flat');
  const material = sourceParameterBinding(table, fields, row), variant = sourceParameterBinding(variants, [{ name: 'fkTr', size: 3 }], row);
  const map = new THREE.DataTexture(new Uint8Array([220, 180, 120, 255]), 1, 1); map.colorSpace = THREE.SRGBColorSpace; map.minFilter = THREE.LinearMipmapLinearFilter; map.magFilter = THREE.LinearFilter; map.needsUpdate = true;
  const textures = { uv: (name: string, uv: ReturnType<typeof T.vec2>) => { assert.equal(name, 'map'); return uv.mul(2).add(0.1); },
    sample: (name: string, uv: ReturnType<typeof T.vec2>, gradient?: Parameters<SourceTextureBinding['sample']>[2]) => { assert.equal(name, 'map'); const sampled = T.texture(map, uv); return gradient ? sampled.grad(gradient.dx, gradient.dy) : sampled; } };
  return { night, table, variants, map, material, variant, textures,
    rawUv: T.attribute('uv', 'vec2'), rawColor: T.attribute('color', 'vec3'),
    frame: { position: T.positionWorld, cameraPosition: T.cameraPosition, normal: T.normalWorld },
    environment: { night, reflectionGain: T.float(1), sunDirection: T.normalize(T.vec3(-0.5, 0.7, 0.3)), sunColor: T.vec3(1, 0.93, 0.82), zenith: T.vec3(0.5, 0.6, 0.75), horizon: T.vec3(0.78, 0.83, 0.9) },
    common: { trim: { ...env, scale: T.vec3(1) }, cityAo: { position: T.positionWorld, normal: T.normalWorld, sample: T.vec2(0.8, 0.01), rect: T.vec4(0, 0, 1, 1), amount: env.cityAOAmt, lb14Gao: env.lb14Gao, night }, cityReflection: { height: T.positionWorld.y, ...env, pbrCity: false } },
  };
}

test('pilot routes verify full captured SHA and reject unported material programs', () => {
  for (const hash of Object.keys(PILOT_FK_PROGRAMS) as (keyof typeof PILOT_FK_PROGRAMS)[]) assert.ok(classifyPilotFk(source(hash)));
  assert.throws(() => classifyPilotFk({ ...source('d1d6ce16'), shaderSha256: '0'.repeat(64) }), /Unverified/);
  assert.throws(() => classifyPilotFk({ ...source('62271fdd'), key: 'different|fknight2' }), /Unsupported/);
});

test('factory binds all eight pilot FK/glass programs to table-driven real material pipelines', async () => {
  installGpuGlobals(); const { device, record } = recordingGpuDevice();
  const renderer = new THREE.WebGPURenderer({ canvas: recordingCanvas(32, 32), device } as never); await renderer.init();
  const f = fixture(), materials: ReturnType<typeof createPilotFkMaterial>[] = [];
  const scene = new THREE.Scene(), geometry = new THREE.PlaneGeometry();
  geometry.setAttribute('aVdSurface', new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position!.count * 4), 4));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position!.count * 3).fill(0.8), 3));
  for (const hash of Object.keys(PILOT_FK_PROGRAMS) as (keyof typeof PILOT_FK_PROGRAMS)[]) {
    const glass = hash === 'd1d6ce16', plain = hash === 'd1ec3ffd' || hash === '289985f3';
    const src = source(hash); if (hash === '1c3d9b8b') src.mapRoles = ['map'];
    const mat = createPilotFkMaterial(THREE, { ...f, name: hash, source: src,
      state: glass ? { ...state, transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor } : state,
      common: { ...f.common, cityReflection: { ...f.common.cityReflection, pbrCity: plain } } });
    materials.push(mat); scene.add(new THREE.Mesh(geometry, mat));
  }
  scene.add(new THREE.HemisphereLight());
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100); camera.position.z = 3;
  renderer.render(scene, camera);
  assert.ok(record.shaders.some(s => s.includes('textureLoad')), 'descriptor and variant tables actually bind');
  assert.equal(materials[5]!.premultipliedAlpha, false);
  const count = record.renderPipelines; f.night.value = 1; renderer.render(scene, camera);
  assert.equal(record.renderPipelines, count, 'dynamic night keeps existing pipelines');
  for (const mat of materials) mat.dispose(); geometry.dispose(); renderer.dispose(); f.table.dispose(); f.variants.dispose(); f.map.dispose();
});

test('missing city tables, map resources and semantic glass blend state fail closed', () => {
  const f = fixture();
  const input = { ...f, name: 'invalid', source: source('1c3d9b8b'), state };
  assert.throws(() => createPilotFkMaterial(THREE, { ...input, common: undefined }), /Missing authored/);
  assert.throws(() => createPilotFkMaterial(THREE, { ...input, source: { ...input.source, mapRoles: ['normalMap'] } }), /Unported/);
  assert.throws(() => createPilotFkMaterial(THREE, { ...input, source: { ...input.source, mapRoles: ['map'] }, textures: { ...f.textures, sample: () => { throw new Error('missing authored texture'); } } }), /missing authored/);
  assert.throws(() => createPilotFkMaterial(THREE, { ...input, material: { ...f.material, scalar: () => { throw new Error('missing field'); } } }), /missing field/);
  assert.throws(() => createPilotFkMaterial(THREE, { ...input, source: source('d1d6ce16') }), /blend contract/);
  f.table.dispose(); f.variants.dispose(); f.map.dispose();
});


test('six additional captured FK level/atlas/self-lit/environment programs compile exact modifier chains', async () => {
  installGpuGlobals(); const {device,record} = recordingGpuDevice();
  const renderer = new THREE.WebGPURenderer({canvas:recordingCanvas(32,32),device} as never); await renderer.init();
  const f = fixture(), scene = new THREE.Scene(), geometry = new THREE.PlaneGeometry();
  geometry.setAttribute('aVdSurface',new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position!.count*4),4));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position!.count*3).fill(0.8),3));
  const materials = [];
  for (const [hash,program] of Object.entries(SOURCE_FK_EXTRA_PROGRAMS)) {
    const source = {key:'onBeforeCompile( /* shaderobject, renderer */ ) {}|lighttrim1,1,1|st34|cityaon|cs34'+program.suffix,
      shaderHash:hash,shaderSha256:program.sha256,type:'MeshStandardMaterial',vertexColors:program.vertexColors,hasAlphaTest:false,
      mapRoles:program.map?['map']:[],attributeRoles:program.level?['aFkTr']:[]};
    assert.equal(classifyPilotFk(source),program.suffix);
    const material = createPilotFkMaterial(THREE,{...f,name:hash,source,state,common:{...f.common,cityReflection:{...f.common.cityReflection,pbrCity:program.suffix.endsWith('|pbcity')}}});
    materials.push(material); scene.add(new THREE.Mesh(geometry,material));
    assert.throws(()=>classifyPilotFk({...source,attributeRoles:['unknown']}),/contract/);
  }
  scene.add(new THREE.HemisphereLight());const camera=new THREE.PerspectiveCamera(60,1,0.1,100);camera.position.z=3;
  renderer.render(scene,camera);
  assert.ok(record.shaders.some(shader=>shader.includes('textureSampleGrad')),'fklva retains source atlas UV gradients');
  const count=record.renderPipelines;f.night.value=1;renderer.render(scene,camera);assert.equal(record.renderPipelines,count);
  for(const m of materials)m.dispose();geometry.dispose();renderer.dispose();f.table.dispose();f.variants.dispose();f.map.dispose();
});


test('second captured kit glass uses its own coating, roughness and dirt program', async()=>{
 installGpuGlobals();const{device,record}=recordingGpuDevice();const renderer=new THREE.WebGPURenderer({canvas:recordingCanvas(32,32),device}as never);await renderer.init();
 const f=fixture(),p=SOURCE_KIT_GLASS_EXTRA,src={...source('d1d6ce16'),key:p.key,shaderHash:p.hash,shaderSha256:p.sha256};
 const material=createPilotFkMaterial(THREE,{...f,name:p.key,source:src,state:{...state,transparent:true,depthWrite:false,blending:THREE.CustomBlending,blendSrc:THREE.OneFactor,blendSrcAlpha:THREE.OneFactor,blendDstAlpha:THREE.OneMinusSrcAlphaFactor}});
 const geometry=new THREE.PlaneGeometry();geometry.setAttribute('aVdSurface',new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position!.count*4),4));geometry.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position!.count*3).fill(0.8),3));
 const scene=new THREE.Scene();scene.add(new THREE.Mesh(geometry,material),new THREE.HemisphereLight());const camera=new THREE.PerspectiveCamera(60,1,0.1,100);camera.position.z=3;renderer.render(scene,camera);assert.ok(record.renderPipelines>0);
 assert.throws(()=>classifyPilotFk({...src,shaderSha256:PILOT_FK_PROGRAMS.d1d6ce16}),/Unverified/);
 material.dispose();geometry.dispose();renderer.dispose();f.table.dispose();f.variants.dispose();f.map.dispose();
});
