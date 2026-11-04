import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { buildCityWorld } from '../../index.ts';
import { parseCityDataset } from '../../../city-dataset.ts';
import { WORLD_PRESETS } from '../../../perf/tier-presets.ts';
import { setVdBlockBytes } from './load.ts';
import { VD_BLOCKS } from './data/manifest.ts';
import { canonicalSurfaceRegistry, type SurfaceRegistry } from './surface-registry.ts';
import { SOURCE_BASE_PARAMETER_FIELDS, SOURCE_PILOT_FRAME_FIELDS } from './source-parameter-layout.ts';
import { SOURCE_STANDARD_PROGRAMS } from './source-standard-programs.ts';
import type { SourceBlockAssets } from './surface-part.ts';

const hash=async(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
const require=createRequire(import.meta.url),meshoptRequire=createRequire(require.resolve('@types/three/package.json'));
const {MeshoptEncoder}=await import(pathToFileURL(meshoptRequire.resolve('meshoptimizer')).href);
const {encodeSurfaceCell}=await import(new URL('../../../../../../../tooling/city/vd-port/surface-codec.mjs',import.meta.url).href);

// Minimal binary/parameter fixture uses a strongly verified authored Standard program.
// This tests the full ownership seam; it makes no texture/visual-parity claim.
async function sourceFixture(){
 const identity=new THREE.Matrix4().toArray();
 const frame:Record<string,number|number[]>={baseY:3.52,curb:.14,affine:[1,1,0,0],isInstanced:0,instanceTranslationXZ:[0,0]};
 for(const name of ['combined','inverseCombined','meshWorld','instanceMatrix','localToScene'])for(let c=0;c<4;c++)frame[`${name}${c}`]=identity.slice(c*4,c*4+4);
 const state={fog:true,side:0,transparent:false,depthWrite:true,depthTest:true,colorWrite:true,blending:1,blendSrc:204,blendDst:205,blendSrcAlpha:null,blendDstAlpha:null,blendEquation:100,blendEquationAlpha:null,premultipliedAlpha:false,alphaHash:false,alphaToCoverage:false,polygonOffset:false,polygonOffsetFactor:0,polygonOffsetUnits:0};
 const program=SOURCE_STANDARD_PROGRAMS.cd0dc17f;
 const document={schema:'vd-block-surfaces',version:1,materialCount:1,variantCount:1,encoding:{layout:1,stride:52},textures:[],
  families:[{id:0,name:'source-standard',supported:true,state,staticFlags:{vertexColors:false,hasAlphaTest:false,renderOrder:0,castShadow:false,receiveShadow:false,textureRoles:[],texturePages:[]}}],
  materials:[{id:0,family:0,type:'MeshStandardMaterial',vertexColors:false,source:{key:program.key,shaderHash:'cd0dc17f',shaderSha256:program.sha256},textureBindings:{},textures:[]}],
  variants:[{fields:{},frame:0}],frames:[frame],coverage:{complete:true,unsupported:[]},
  parameters:{materialCount:1,families:[{id:0,fields:SOURCE_BASE_PARAMETER_FIELDS,materials:[{id:0,values:{diffuse:[1,1,1],emissive:[0,0,0],emissiveIntensity:1,opacity:1,roughness:.5,metalness:0,alphaTest:0,envMapIntensity:1}}]}],
   variantFields:[{name:'frameRow',size:1}],variants:[{frameRow:0}],frameFields:SOURCE_PILOT_FRAME_FIELDS,frames:[frame]}};
 const registry={...document,sha256:await hash(new TextEncoder().encode(canonicalSurfaceRegistry(document)))} as SurfaceRegistry;
 const surface={sha256:registry.sha256,materialCount:1,variantCount:1};
 const encoded:{bytes:Uint8Array}=await encodeSurfaceCell({cx:0,cz:1,registry:surface,encoder:MeshoptEncoder,
  vertices:[[1,1,130],[2,1,130],[1,2,130]].map(position=>({position,normal:[0,0,1],color:[1,1,1],uv:[0,0],material:0,variant:0,grime:0,weather:[0,0,4,-1],flags:63})),indices:[0,1,2]});
 let reads=0;
 const source:SourceBlockAssets={registry,expectedSha256:registry.sha256,manifest:{version:1,pages:[],cityAORect:[0,0,1,1]},
  materialBytes:65536,budget:{name:'source-fixture',geometryBytes:32*1024*1024,triangles:500000,cellDraws:32},
  cells:[{key:'0_1-f0',cx:0,cz:1,family:0,vertices:3,triangles:1,wide:false,bounds:[1,1,130,2,2,130],bytes:234,textures:[],materials:[0],variants:[0],surface,fileBytes:encoded.bytes.length,sha256:await hash(encoded.bytes)}],
  async readCell(){reads++;return encoded.bytes;},async readPage(){assert.fail('Fixture has no texture payloads');},sha256Hex:hash};
 return {source,reads:()=>reads};
}

test('full source part → blocks → port → world START gate resolves far without IO, then activates real near demand',async()=>{
 const fixture=await sourceFixture(),data=new URL('./data/',import.meta.url);
 const near=new Map(VD_BLOCKS.lite.map(cell=>[cell.key,new Uint8Array(readFileSync(new URL(`lite/${cell.key}.bin`,data)))]));
 setVdBlockBytes({surface:fixture.source,shell:new Uint8Array(readFileSync(new URL('shell.bin',data))),near,level:'lite'});
 const dataset=parseCityDataset(JSON.parse(readFileSync(new URL('../../../data/harlem-apollo.json',import.meta.url),'utf8')));
 let compiled=0;const stages:string[]=[];
 const world=buildCityWorld(THREE,dataset,{vd:true,stream:{preset:WORLD_PRESETS['ipad-a12x'],log:(event,data)=>{if(event==='source-assets')stages.push(String(data.stage));}}});
 try{
  world.setPrepareTemplates(async templates=>{compiled+=templates.length;});
  world.primeStream({x:10000,y:2,z:10000},1500,150);
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{await Promise.race([world.ready,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('START gate deadlocked')),2000);})]);}finally{clearTimeout(timer);}
  assert.equal(fixture.reads(),0);assert.equal(compiled,0);assert.ok(stages.includes('prime'));assert.ok(stages.includes('ready'));
  for(let i=0;i<30 && compiled===0;i++){world.updateStream({x:1,y:2,z:130},1500,i/60);await new Promise(resolve=>setImmediate(resolve));}
  assert.equal(compiled,1);assert.equal(fixture.reads(),1);assert.ok(stages.includes('compiled'));
 }finally{world.dispose();setVdBlockBytes(null);}
});
