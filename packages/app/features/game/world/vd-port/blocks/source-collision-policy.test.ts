import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sourceCollisionPolicy } from './source-collision-policy.ts';
import type { SurfaceFamily, SurfaceMaterial } from './surface-registry.ts';
import { SOURCE_STANDARD_PROGRAMS } from './source-standard-programs.ts';
import { SOURCE_SIGN_EXTRA_PROGRAMS } from './source-sign-programs.ts';
import { SOURCE_PBR_GLASS_PROGRAMS } from './source-glass-programs.ts';
import { SOURCE_KIT_GLASS_EXTRA } from './source-fk-programs.ts';
import { SOURCE_APOLLO_IDENTITIES } from './source-apollo-programs.ts';
import { SOURCE_VEGETATION_IDENTITIES } from './source-vegetation-programs.ts';

function fixture(name:string,key:string,hash:string,sha256:string,options:{type?:string;alpha?:boolean;transparent?:boolean;blending?:number;colors?:boolean;maps?:string[];attrs?:string[]}={}){
 const family={id:0,name,state:{transparent:options.transparent??false,blending:options.blending??1},
  staticFlags:{vertexColors:options.colors??false,hasAlphaTest:options.alpha??false}} as SurfaceFamily;
 const material={id:0,family:0,type:options.type??'MeshStandardMaterial',vertexColors:options.colors??false,
  source:{key,shaderHash:hash,shaderSha256:sha256},shader:{attrs:options.attrs??[]},textureBindings:Object.fromEntries((options.maps??[]).map(role=>[role,{}]))} as unknown as SurfaceMaterial;
 return {family,material};
}
function policy(f:ReturnType<typeof fixture>){return sourceCollisionPolicy(f.family,f.material);}

test('verified opaque Standard walls and solid SG boards retain camera and body triangles',()=>{
 const standard=SOURCE_STANDARD_PROGRAMS.cd0dc17f;
 const wall=fixture('source-standard',standard.key,'cd0dc17f',standard.sha256);
 assert.deepEqual([policy(wall).camera,policy(wall).body],[true,true]);
 const sg=SOURCE_SIGN_EXTRA_PROGRAMS.ar33sgDu;
 const board=fixture('source-sign','onBeforeCompile( /* shaderobject, renderer */ ) {}|lighttrim1,1,1|st34|ar33sgDu',sg.hash,sg.sha256);
 assert.deepEqual([policy(board).camera,policy(board).body],[true,true]);
});

test('both strong kit and PBR glass programs block camera and body despite compositing',()=>{
 const kit=SOURCE_KIT_GLASS_EXTRA;
 const pane=fixture('source-fk',kit.key,kit.hash,kit.sha256,{colors:true,transparent:true,blending:5});
 const glass=SOURCE_PBR_GLASS_PROGRAMS['pbrglass4|t|st'];
 const pbr=fixture('source-glass','pbrglass4|t|st',glass.hash,glass.sha256,{transparent:true,blending:5});
 for(const f of [pane,pbr])assert.deepEqual([policy(f).camera,policy(f).body],[true,true]);
});

test('cutout and non-glass transparent surfaces explicitly exclude unsupported alpha-shaped collision',()=>{
 const program=SOURCE_STANDARD_PROGRAMS.cd0dc17f;
 for(const options of [{alpha:true},{transparent:true}]){
  const result=policy(fixture('source-standard',program.key,'cd0dc17f',program.sha256,options));
  assert.equal(result.camera,false);assert.equal(result.body,false);assert.match(result.reason,/alpha|transparent/);
 }
 const vg=SOURCE_VEGETATION_IDENTITIES[0];
 const leaf=policy(fixture('source-vegetation',vg.key,vg.hash,vg.sha256,{colors:true,alpha:true,maps:['map']}));
 assert.equal(leaf.camera,false);assert.match(leaf.reason,/foliage/);
});

test('only verified Basic effect roles are excluded; unknown opaque Basic and unverified programs fail closed',()=>{
 const tube=SOURCE_APOLLO_IDENTITIES['a32tube0.62,0.68,0.760.22,0.48,1.35'];
 const result=policy(fixture('source-apollo',tube.key,tube.hash,tube.sha256,{type:tube.type}));
 assert.equal(result.camera,false);assert.match(result.reason,/tube/);
 const basic=SOURCE_STANDARD_PROGRAMS['30f27eeb'];
 assert.throws(()=>policy(fixture('source-standard',basic.key,'30f27eeb',basic.sha256,{type:basic.type})),/Unknown authored collision role/);
 const bad=fixture('source-standard',basic.key,'30f27eeb','00'.repeat(32),{type:basic.type});
 assert.throws(()=>policy(bad),/Unverified/);
 const sg=SOURCE_SIGN_EXTRA_PROGRAMS.ar33sgH;
 assert.equal(policy(fixture('source-sign','base|ar33sgH',sg.hash,sg.sha256,{type:sg.type,transparent:true,blending:2,maps:['map']})).body,false);
});


test('verified flora LOD callback trigger excludes collision only with exact no-output state',()=>{
 const basic=SOURCE_STANDARD_PROGRAMS['30f27eeb'];
 const f=fixture('source-standard',basic.key,'30f27eeb',basic.sha256,{type:basic.type});
 Object.assign(f.family.staticFlags,{renderOrder:-1000});
 Object.assign(f.family.state,{colorWrite:false,depthWrite:false,depthTest:false});
 assert.match(policy(f).reason,/LOD callback/);assert.equal(policy(f).camera,false);assert.equal(policy(f).body,false);
 for(const field of ['colorWrite','depthWrite','depthTest'] as const){
  f.family.state[field]=true;
  assert.throws(()=>policy(f),/Unknown authored collision role/);
  f.family.state[field]=false;
 }
 f.family.staticFlags.renderOrder=0;assert.throws(()=>policy(f),/Unknown authored collision role/);
});
