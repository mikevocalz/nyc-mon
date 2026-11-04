import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { createSurfaceMaterialBank } from './surface-material-bank.ts';
import { createSourcePageLoader, type SourcePageSpec } from './source-page-loader.ts';
import { canonicalSurfaceRegistry, type SurfaceRegistry } from './surface-registry.ts';
import { SOURCE_BASE_PARAMETER_FIELDS, SOURCE_VARIANT_PARAMETER_FIELDS, SOURCE_PILOT_FRAME_FIELDS } from './source-parameter-layout.ts';
import { PILOT_FK_PROGRAMS } from './source-fk-programs.ts';
import type { SourceRenderState } from './source-standard.ts';
import type { NearCellInfo } from './codec.ts';

const hash = async (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
async function fixture() {
  const payload = new Uint8Array([180, 0]);
  const page: SourcePageSpec = { id: 0, sha256: await hash(payload), sourceBytes: 2, gpuBytes: 2, width: 1, height: 1, layers: 1,
    format: THREE.RGFormat, type: THREE.UnsignedByteType,
    sampler: { colorSpace: '', wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping, flipY: false, premultiplyAlpha: false,
      unpackAlignment: 1, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, anisotropy: 1, generateMipmaps: false },
    mipLevels: [{ width: 1, height: 1, byteOffset: 0, byteLength: 2, layerBytes: 2 }] };
  const texture = { id: 0, semantic: 'env:cityAO', page: 0, layer: 0, sha256: page.sha256, width: 1, height: 1, format: page.format, type: page.type, ...page.sampler };
  const state: SourceRenderState = { fog: true, side: 0, transparent: false, depthWrite: true, depthTest: true, colorWrite: true,
    blending: THREE.NormalBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: null, blendDstAlpha: null, blendEquation: THREE.AddEquation, blendEquationAlpha: null,
    premultipliedAlpha: false, alphaHash: false, alphaToCoverage: false, polygonOffset: false, polygonOffsetFactor: 0, polygonOffsetUnits: 0 };
  const variant: Record<string, number | number[]> = {};
  for (const field of SOURCE_VARIANT_PARAMETER_FIELDS) variant[field.name] = field.size === 1 ? 0 : new Array<number>(field.size).fill(field.name === 'fkTr' || field.name === 'instanceColor' ? 1 : 0);
  const identity = new THREE.Matrix4().toArray();
  const frame: Record<string, number | number[]> = {baseY:3.52,curb:0.14,affine:[1,1,0,0],isInstanced:0,instanceTranslationXZ:[0,0]};
  for(const name of ['combined','inverseCombined','meshWorld','instanceMatrix','localToScene'])for(let column=0;column<4;column++)frame[`${name}${column}`]=identity.slice(column*4,column*4+4);
  const frames = [frame];
  const document = { schema: 'vd-block-surfaces', version: 1, materialCount: 1, variantCount: 1, encoding: { layout: 1, stride: 52 },
    textures: [texture],
    families: [{ id: 0, name: 'source-fk', supported: true, state,
      staticFlags: { vertexColors: true, hasAlphaTest: false, renderOrder: 2, textureRoles: [], texturePages: [] } }],
    materials: [{ id: 0, family: 0, type: 'MeshStandardMaterial', vertexColors: true,
      source: { key: 'base|lighttrim1,1,1|st34|cityaon|cs34|fkin0.6,0.85|fknight1', shaderHash: '230396d1', shaderSha256: PILOT_FK_PROGRAMS['230396d1'] },
      textureBindings: { 'uniform:cityAO': { ...texture, texture: 0 } }, textures: [0] }],
    variants: [{ fields: {}, frame: 0 }], frames, coverage: { complete: true, unsupported: [] },
    parameters: { materialCount: 1, families: [{ id: 0, fields: SOURCE_BASE_PARAMETER_FIELDS, materials: [{ id: 0,
      values: { diffuse: [1, 1, 1], emissive: [0, 0, 0], emissiveIntensity: 1, opacity: 1, roughness: 0.5, metalness: 0, alphaTest: 0, envMapIntensity: 1 } }] }],
    variantFields: SOURCE_VARIANT_PARAMETER_FIELDS, variants: [variant], frameFields: SOURCE_PILOT_FRAME_FIELDS, frames } };
  const registry = { ...document, sha256: await hash(new TextEncoder().encode(canonicalSurfaceRegistry(document))) } as SurfaceRegistry;
  const manifest = { version: 1 as const, pages: [page], cityAORect: [-1, -1, 0.5, 0.5] };
  let reads = 0;
  const loader = createSourcePageLoader(THREE, { namespace: 'test', manifest,
    readPayload: async () => { reads++; return payload; }, sha256Hex: hash });
  const T = THREE.TSL;
  return { registry, manifest, loader, reads: () => reads,
    environment: { night: T.uniform(0), reflectionGain: T.float(1), sunDirection: T.vec3(0, 1, 0), sunColor: T.vec3(1), zenith: T.vec3(0.2, 0.3, 0.5), horizon: T.vec3(0.6) } };
}

test('each live package keeps its own page lease while shared family materials reuse one resident page', async () => {
  const f = await fixture();
  const bank = await createSurfaceMaterialBank(THREE, { ...f, namespace: 'test', expectedSha256: f.registry.sha256, limitBytes: 10000, sha256Hex: hash });
  const cell: NearCellInfo & { textures: number[] } = { key: '0_0-f0', cx: 0, cz: 0, family: 0, vertices: 3, triangles: 1,
    wide: false, bounds: [0, 0, 0, 1, 1, 1], bytes: 234, textures: [0], surface: { sha256: f.registry.sha256, materialCount: 1, variantCount: 1 } };
  const a = bank.resources(cell, [cell]), b = bank.resources(cell, [cell]);
  assert.equal(await a.prefetch(), true); assert.equal(await b.prefetch(), true);
  assert.equal(f.reads(), 1);
  a.release(); assert.equal(a.ready(), false); assert.equal(b.ready(), true, 'another live package still owns its lease');
  const initial = bank.lease([cell]); assert.equal(await initial.prefetch(), true);
  const material = bank.material(0, initial);
  assert.equal(bank.material(0, initial), material);
  assert.equal(bank.renderOrder(0), 2);
  assert.deepEqual([bank.collisionPolicy(0).camera,bank.collisionPolicy(0).body],[true,true]);
  assert.throws(()=>bank.collisionPolicy(999),/Unknown authored collision family/);
  initial.release(); b.release(); bank.dispose(); bank.dispose();
  assert.equal(bank.bytes, 0);
  assert.throws(() => bank.lease([cell]), /disposed/);
});

test('cancellation during registry authentication never allocates late scene resources', async () => {
  const f = await fixture(), controller = new AbortController();
  let finish!: (value: string) => void;
  const pending = createSurfaceMaterialBank(THREE, { ...f, namespace: 'test', expectedSha256: f.registry.sha256, limitBytes: 10000,
    signal: controller.signal, sha256Hex: () => new Promise<string>((resolve) => { finish = resolve; }) });
  controller.abort(); finish(f.registry.sha256);
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(f.reads(), 0);
});

test('scene abort during page IO closes leases and rejects late readiness', async () => {
  const f = await fixture(), controller = new AbortController();
  let finish!: (bytes: Uint8Array) => void;
  const loader = createSourcePageLoader(THREE, { namespace: 'test', manifest: f.manifest,
    readPayload: () => new Promise<Uint8Array>((resolve) => { finish = resolve; }), sha256Hex: hash });
  const bank = await createSurfaceMaterialBank(THREE, { ...f, loader, namespace: 'test', expectedSha256: f.registry.sha256, limitBytes: 10000,
    signal: controller.signal, sha256Hex: hash });
  const cell: NearCellInfo & { textures: number[] } = { key: '0_0-f0', cx: 0, cz: 0, family: 0, vertices: 3, triangles: 1,
    wide: false, bounds: [0, 0, 0, 1, 1, 1], bytes: 234, textures: [0], surface: { sha256: f.registry.sha256, materialCount: 1, variantCount: 1 } };
  const lease = bank.lease([cell]), pending = lease.prefetch();
  await Promise.resolve();
  controller.abort(); finish(new Uint8Array([180, 0]));
  assert.equal(await pending, false);
  assert.equal(lease.ready(), false);
  assert.equal(bank.bytes, 0);
});

test('shared bank routes authenticated generic, sign, Apollo, custom-MR and glass families through their actual factories',async()=>{
 const {SOURCE_FK_EXTRA_PROGRAMS,SOURCE_KIT_GLASS_EXTRA,pilotFkParameterSchema}=await import('./source-fk-programs.ts');
 const {SOURCE_STANDARD_PROGRAMS,sourceStandardParameterSchema}=await import('./source-standard-programs.ts');
 const {SOURCE_SIGN_EXTRA_PROGRAMS,sourceSignParameterSchema}=await import('./source-sign-programs.ts');
 const {SOURCE_APOLLO_IDENTITIES,apolloParameterSchema}=await import('./source-apollo-programs.ts');
 const {SOURCE_CUSTOM_BUILDING_IDENTITIES,customBuildingParameterSchema}=await import('./source-custom-building-programs.ts');
 const {SOURCE_PBR_GLASS_PROGRAMS,sourcePbrGlassParameterSchema}=await import('./source-glass-programs.ts');
 const standard=SOURCE_STANDARD_PROGRAMS['30f27eeb'],sign=SOURCE_SIGN_EXTRA_PROGRAMS.ar33sgDu,apollo=Object.values(SOURCE_APOLLO_IDENTITIES).find(p=>p.type==='MeshBasicMaterial')!,custom=SOURCE_CUSTOM_BUILDING_IDENTITIES.find(p=>p.program==='monument-reflection')!,glass=SOURCE_PBR_GLASS_PROGRAMS['pbrglass4|o'];
 const extraFk=SOURCE_FK_EXTRA_PROGRAMS.c8a4d7c4,kit=SOURCE_KIT_GLASS_EXTRA;
 const definitions=[
  {name:'source-fk',key:'onBeforeCompile( /* shaderobject, renderer */ ) {}|lighttrim1,1,1|st34|cityaon|cs34'+extraFk.suffix,hash:'c8a4d7c4',sha256:extraFk.sha256,type:'MeshStandardMaterial',schema:pilotFkParameterSchema,basic:false,vertexColors:true,attrs:['aFkTr']},
  {name:'source-fk',key:kit.key,hash:kit.hash,sha256:kit.sha256,type:'MeshStandardMaterial',schema:pilotFkParameterSchema,basic:false,vertexColors:true,attrs:[],kit:true},
  {name:'source-standard',key:standard.key,hash:'30f27eeb',sha256:standard.sha256,type:standard.type,schema:sourceStandardParameterSchema,basic:true},
  {name:'source-sign',key:'base|ar33sgDu',hash:sign.hash,sha256:sign.sha256,type:sign.type,schema:sourceSignParameterSchema,basic:false},
  {name:'source-apollo',key:apollo.key,hash:apollo.hash,sha256:apollo.sha256,type:apollo.type,schema:apolloParameterSchema,basic:true},
  {name:'source-custom-building',key:custom.key,hash:custom.hash,sha256:custom.sha256,type:custom.type,schema:customBuildingParameterSchema,basic:false},
  {name:'source-glass',key:'pbrglass4|o',hash:glass.hash,sha256:glass.sha256,type:'MeshStandardMaterial',schema:sourcePbrGlassParameterSchema,basic:false},
 ];
 for(const definition of definitions){
  const f=await fixture();const old=f.registry,oldFamily=old.families[0]!,oldMaterial=old.materials[0]!;
  const identity={key:definition.key,shaderHash:definition.hash,shaderSha256:definition.sha256,type:definition.type,vertexColors:definition.vertexColors??false,hasAlphaTest:false,mapRoles:[],attributeRoles:definition.attrs??[]};
  const schema=definition.schema(identity),values:Record<string,number|number[]>={};
  for(const field of schema.material)values[field.name]=field.size===1?1:new Array(field.size).fill(field.name==='emissive'?0:0.3);
  Object.assign(values,{pgRm:[3.7,0,7,1.45],pgOrg:[0,0,0]});
  const document={...old,families:[{...oldFamily,name:definition.name,state:definition.kit?{...oldFamily.state,transparent:true,depthWrite:false,blending:THREE.CustomBlending,blendSrc:THREE.OneFactor,blendSrcAlpha:THREE.OneFactor,blendDstAlpha:THREE.OneMinusSrcAlphaFactor}:oldFamily.state,staticFlags:{...oldFamily.staticFlags,vertexColors:identity.vertexColors}}],materials:[{...oldMaterial,type:definition.type,vertexColors:identity.vertexColors,source:{key:definition.key,shaderHash:definition.hash,shaderSha256:definition.sha256},shader:{attrs:identity.attributeRoles}}],parameters:{...old.parameters,families:[{id:0,fields:schema.material,materials:[{id:0,values}]}]}};
  const {sha256:_previous,...withoutHash}=document;const registry={...withoutHash,sha256:await hash(new TextEncoder().encode(canonicalSurfaceRegistry(withoutHash)))} as SurfaceRegistry;
  const bank=await createSurfaceMaterialBank(THREE,{...f,registry,expectedSha256:registry.sha256,namespace:'test',limitBytes:100000,sha256Hex:hash});
  const cell:NearCellInfo&{textures:number[]}={key:'0_0-f0',cx:0,cz:0,family:0,vertices:3,triangles:1,wide:false,bounds:[0,0,0,1,1,1],bytes:234,textures:[0],surface:{sha256:registry.sha256,materialCount:1,variantCount:1}};
  const lease=bank.lease([cell]);assert.equal(await lease.prefetch(),true);const material=bank.material(0,lease);assert.equal(material instanceof THREE.MeshBasicNodeMaterial,definition.basic,definition.name);lease.release();bank.dispose();
 }
});
