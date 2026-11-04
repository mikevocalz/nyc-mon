import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { createSourceSignMaterial, classifySourceSignMaterial, SOURCE_SIGN_FACE_PROGRAMS, SOURCE_SIGN_GLOW_VC, SOURCE_SIGN_EXTRA_PROGRAMS, type SourceSignFaceIdentity } from './source-sign-factory.ts';
import { sourceParameterBinding } from './source-bindings.ts';
import { createMaterialTable, packParameterRows, type ParameterField } from './material-table.ts';
import { sourceEnvironmentNodes } from './source-environment.ts';
import type { SourceRenderState } from './source-standard.ts';
import { installGpuGlobals, recordingCanvas, recordingGpuDevice } from '../../../render-runtime/recording-gpu.test-support.ts';
const prefix = 'onBeforeCompile( /* shaderobject, renderer */ ) {}|lighttrim1,1,1|st34|';
const state: SourceRenderState = { fog: true, side: THREE.FrontSide, transparent: false, depthWrite: true, depthTest: true, colorWrite: true, blending: THREE.NormalBlending,
  blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: null, blendDstAlpha: null, blendEquation: THREE.AddEquation, blendEquationAlpha: null,
  premultipliedAlpha: false, alphaHash: false, alphaToCoverage: false, polygonOffset: false, polygonOffsetFactor: 0, polygonOffsetUnits: 0 };
const fields: ParameterField[] = [{ name: 'diffuse', size: 3 }, { name: 'emissive', size: 3 }, { name: 'sgEm', size: 3 }, ...['sgDay', 'sgNd', 'sgGain', 'emissiveIntensity', 'opacity', 'alphaTest', 'envMapIntensity', 'sgSatK', 'roughness', 'metalness'].map(name => ({ name, size: 1 as const }))];
const vf: ParameterField[] = [{ name: 'sgRect', size: 4 }, { name: 'sgBg', size: 3 }, { name: 'sgFg', size: 3 }, { name: 'sgLamp', size: 3 }, { name: 'sgP', size: 4 }, { name: 'sgF', size: 4 }];
function fixture() {
  const T = THREE.TSL, night = T.uniform(0), env = sourceEnvironmentNodes(THREE, night);
  const table = createMaterialTable(THREE, packParameterRows('sign-material', fields, [{ sgEm: [1.4, 0.9, 0.02], sgDay: 0.08, sgNd: 1, sgGain: 1.4, diffuse: [1, 1, 1], emissive: [0, 0, 0], emissiveIntensity: 1, opacity: 1, alphaTest: 0.02, envMapIntensity: 1, sgSatK: 0.75, roughness: 0.32, metalness: 0 }]));
  const variants = createMaterialTable(THREE, packParameterRows('sign-variants', vf, [{ sgRect: [0.2, 0.1, 0.6, 0.8], sgBg: [0.2, 0.1, 0.05], sgFg: [1, 0.8, 0.2], sgLamp: [1.5, 1.2, 0.3], sgP: [0.3, 0.2, 0.08, 0.32], sgF: [0.3, 2, 1, 0] }]));
  const row = T.varying(T.attribute('aVdSurface', 'vec4').y).setInterpolation('flat');
  const material = sourceParameterBinding(table, fields, row), variant = sourceParameterBinding(variants, vf, row);
  const mask = new THREE.DataTexture(new Uint8Array([128]), 1, 1, THREE.RedFormat); mask.needsUpdate = true;
  const face = new THREE.DataTexture(new Uint8Array([200, 120, 20, 128]), 1, 1); face.colorSpace = THREE.SRGBColorSpace; face.needsUpdate = true;
  return { table, variants, mask, face, material, variant, night, trim: { ...env, scale: T.vec3(1) }, rawUv: T.attribute('uv', 'vec2'), rawColor: T.attribute('color', 'vec3') };
}
function identity(program: keyof typeof SOURCE_SIGN_FACE_PROGRAMS): SourceSignFaceIdentity {
  const p = SOURCE_SIGN_FACE_PROGRAMS[program], mask = program[7] === 'M';
  return { key: prefix + program, shaderHash: p.hash, shaderSha256: p.sha256, type: 'MeshStandardMaterial', vertexColors: false,
    hasAlphaTest: program.endsWith('d'), mapRoles: ['map'], mapFormat: mask ? THREE.RedFormat : THREE.RGBAFormat, mapColorSpace: mask ? THREE.NoColorSpace : THREE.SRGBColorSpace };
}
test('settled sign face and glow-VC shader identities require full captured SHA', () => {
  for (const p of Object.keys(SOURCE_SIGN_FACE_PROGRAMS) as (keyof typeof SOURCE_SIGN_FACE_PROGRAMS)[]) assert.equal(classifySourceSignMaterial(identity(p)).program, p);
  assert.throws(() => classifySourceSignMaterial({ ...identity('ar33sg3Md'), shaderSha256: '0'.repeat(64) }), /Unverified/);
  assert.equal(classifySourceSignMaterial({ ...identity('ar33sg3Md'), key: prefix + 'ar33sgGvc', shaderHash: SOURCE_SIGN_GLOW_VC.hash, shaderSha256: SOURCE_SIGN_GLOW_VC.sha256 }).program, 'ar33sgGvc');
});
test('all four source atlas roles and glow-VC build actual table-bound pipelines with decal coverage and EASE', async () => {
  installGpuGlobals(); const { device, record } = recordingGpuDevice(); const renderer = new THREE.WebGPURenderer({ canvas: recordingCanvas(32, 32), device } as never); await renderer.init();
  const f = fixture(), T = THREE.TSL, scene = new THREE.Scene(), geometry = new THREE.PlaneGeometry();
  geometry.setAttribute('aVdSurface', new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position!.count * 4), 4));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position!.count * 3).fill(0.8), 3));
  const mats = [];
  for (const program of Object.keys(SOURCE_SIGN_FACE_PROGRAMS) as (keyof typeof SOURCE_SIGN_FACE_PROGRAMS)[]) {
    const source = identity(program), decal = source.hasAlphaTest;
    let matrixCalls = 0, sampleCalls = 0;
    const mat = createSourceSignMaterial(THREE, { ...f, name: program, source, state: { ...state, transparent: decal, depthWrite: !decal, polygonOffset: decal, polygonOffsetFactor: decal ? -2 : 0, polygonOffsetUnits: decal ? -2 : 0 },
      textures: { uv: (_, uv) => { matrixCalls++; return uv.mul(2).add(0.1); }, sample: (_, uv) => { sampleCalls++; return T.texture(source.mapFormat === THREE.RedFormat ? f.mask : f.face, uv); } } });
    assert.equal(matrixCalls, 1, 'original transform only feeds grime/falloff'); assert.equal(sampleCalls, 1, 'atlas receives explicit rect UV without a second transform');
    mats.push(mat); scene.add(new THREE.Mesh(geometry, mat));
  }
  const glow = createSourceSignMaterial(THREE, { ...f, name: 'glowvc', source: { key: prefix + 'ar33sgGvc', shaderHash: SOURCE_SIGN_GLOW_VC.hash, shaderSha256: SOURCE_SIGN_GLOW_VC.sha256, type: 'MeshStandardMaterial', vertexColors: true, hasAlphaTest: false, mapRoles: [] }, state,
    textures: { uv: () => { throw new Error('No glow atlas'); }, sample: () => { throw new Error('No glow atlas'); } } });
  mats.push(glow); scene.add(new THREE.Mesh(geometry, glow), new THREE.HemisphereLight());
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100); camera.position.z = 3; renderer.render(scene, camera);
  assert.ok(record.shaders.some(s => s.includes('discard')), 'decal table alphaTest performs coverage discard');
  assert.ok(record.shaders.some(s => s.includes('textureLoad')), 'variant and material parameter tables bind');
  const count = record.renderPipelines; f.night.value = 1; renderer.render(scene, camera); assert.equal(record.renderPipelines, count);
  for (const m of mats) m.dispose(); geometry.dispose(); renderer.dispose(); f.table.dispose(); f.variants.dispose(); f.mask.dispose(); f.face.dispose();
});
test('missing atlas, variant data and wrong source alpha/channel contracts reject before publication', () => {
  const f = fixture(), input = { ...f, name: 'bad', source: identity('ar33sg3Md'), state: { ...state, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }, textures: { uv: (_: string, uv: ReturnType<typeof THREE.TSL.vec2>) => uv, sample: () => { throw new Error('missing authored atlas'); } } };
  assert.throws(() => createSourceSignMaterial(THREE, input), /missing authored atlas/);
  assert.throws(() => createSourceSignMaterial(THREE, { ...input, source: { ...input.source, mapFormat: THREE.RGBAFormat } }), /channel/);
  assert.throws(() => createSourceSignMaterial(THREE, { ...input, state }), /render-state/);
  assert.throws(() => createSourceSignMaterial(THREE, { ...input, variant: { ...f.variant, vec4: () => { throw new Error('missing sgRect'); } } }), /sgRect/);
  f.table.dispose(); f.variants.dispose(); f.mask.dispose(); f.face.dispose();
});


test('dust, uniform glow, RG shadow/spill and additive halo use their exact authored material families', async () => {
  installGpuGlobals(); const {device,record}=recordingGpuDevice();const renderer=new THREE.WebGPURenderer({canvas:recordingCanvas(32,32),device} as never);await renderer.init();
  const f=fixture(),T=THREE.TSL,scene=new THREE.Scene(),geometry=new THREE.PlaneGeometry();
  geometry.setAttribute('aVdSurface',new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position!.count*4),4));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position!.count*3).fill(0.8),3));
  const shadow=new THREE.DataTexture(new Uint8Array([150,80,0,255]),1,1);shadow.needsUpdate=true;
  const materials=[];
  for(const [program,definition] of Object.entries(SOURCE_SIGN_EXTRA_PROGRAMS)) {
    const shade=program==='ar33sgS3',halo=program==='ar33sgH',basic=shade||halo;
    const source={key:basic?program:prefix+program,shaderHash:definition.hash,shaderSha256:definition.sha256,type:definition.type,vertexColors:program==='ar33sgDu',hasAlphaTest:false,
      mapRoles:basic?['map']:[],attributeRoles:shade?['sgRect','sgBg','sgFg','sgLamp','sgP','sgF']:[],mapFormat:THREE.RGBAFormat,mapColorSpace:shade?THREE.NoColorSpace:THREE.SRGBColorSpace};
    assert.equal(classifySourceSignMaterial(source).program,program);
    const extraState=basic?{...state,transparent:true,depthWrite:false,fog:!shade,blending:shade?THREE.CustomBlending:THREE.AdditiveBlending,
      blendSrc:shade?THREE.OneFactor:THREE.SrcAlphaFactor,blendSrcAlpha:shade?THREE.ZeroFactor:null,blendDstAlpha:shade?THREE.OneFactor:null,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3}:state;
    const material=createSourceSignMaterial(THREE,{...f,name:program,source,state:extraState,textures:{uv:(_,uv)=>uv,sample:(_,uv)=>T.texture(shade?shadow:f.face,uv)}});
    assert.equal(material instanceof THREE.MeshBasicNodeMaterial,basic);assert.equal(material.premultipliedAlpha,false);
    materials.push(material);scene.add(new THREE.Mesh(geometry,material));
    assert.throws(()=>classifySourceSignMaterial({...source,mapRoles:basic?[]:['map']}),/contract/);
  }
  scene.add(new THREE.HemisphereLight());const camera=new THREE.PerspectiveCamera(60,1,0.1,100);camera.position.z=3;renderer.render(scene,camera);
  const count=record.renderPipelines;f.night.value=1;renderer.render(scene,camera);assert.equal(record.renderPipelines,count);
  for(const m of materials)m.dispose();geometry.dispose();renderer.dispose();f.table.dispose();f.variants.dispose();f.mask.dispose();f.face.dispose();shadow.dispose();
});
