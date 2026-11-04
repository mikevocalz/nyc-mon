import assert from 'node:assert/strict';import{test}from'node:test';
import{buildSurfaceParameters}from'./surface-parameters.mjs';
import{SOURCE_STANDARD_PROGRAMS}from'../../../packages/app/features/game/world/vd-port/blocks/source-standard-programs.ts';
import{SOURCE_APOLLO_IDENTITIES}from'../../../packages/app/features/game/world/vd-port/blocks/source-apollo-programs.ts';
import{SOURCE_PBR_GLASS_PROGRAMS}from'../../../packages/app/features/game/world/vd-port/blocks/source-glass-programs.ts';
const I=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const frame=()=>({meshMatrixWorld:[...I],instanceMatrix:[...I],combinedMatrix:[...I],isInstanced:false,hasInstanceColor:false,instanceTranslationXZ:[0,0],baseY:3.52,curb:0.14,affine:{sx:1,sz:1,ox:0,oz:0}});
const family=name=>({id:0,name,staticFlags:{textureRoles:[],vertexColors:false,hasAlphaTest:false}});
const basic=()=>{const p=SOURCE_STANDARD_PROGRAMS['30f27eeb'];return{id:0,family:0,type:p.type,color:[.2,.3,.4],opacity:1,alphaTest:0,vertexColors:false,source:{key:p.key,shaderHash:'30f27eeb',shaderSha256:p.sha256},shader:{attrs:[],uniforms:{}},textureBindings:{},environment:{hasMaterialEnvMap:false}};};
const registry=(name,material,fields={})=>({materialCount:1,materials:[material],families:[family(name)],variants:[{fields,frame:0,materials:[0]}],frames:[frame()]});
test('actual Basic families omit nonexistent Standard-only fields instead of inventing material values',()=>{
 const b=buildSurfaceParameters(registry('source-standard',basic()));assert.deepEqual(b.families[0].fields.map(f=>f.name),['diffuse','opacity','alphaTest']);
 const p=Object.values(SOURCE_APOLLO_IDENTITIES).find(p=>p.type==='MeshBasicMaterial'),m={...basic(),source:{key:p.key,shaderHash:p.hash,shaderSha256:p.sha256}};
 const a=buildSurfaceParameters(registry('source-apollo',m));assert.deepEqual(a.families[0].fields.map(f=>f.name),['diffuse','opacity']);
 assert.equal(a.families[0].materials[0].values.emissive,undefined);assert.deepEqual(a.variants[0].instanceColor,[1,1,1]);
});
function glass(){const p=SOURCE_PBR_GLASS_PROGRAMS['pbrglass4|o|st|ca'];return{...basic(),type:'MeshStandardMaterial',emissive:[0,0,0],emissiveIntensity:1,roughness:.1,metalness:0,
 source:{key:'pbrglass4|o|st|ca',shaderHash:p.hash,shaderSha256:p.sha256},shader:{attrs:['aFkTr','aPgBody'],uniforms:{pgF0:.2,pgRough:.1,pgDirt:.2,pgStW:30.5,pgBody:[.1,.2,.3],pgOrg:[100,0,200],pgRm:[3.7,0,7,1.45],pgBl:.85,pgTr:.6,pgSd:3,pgShr:.2,pgGlow:0,pgSlk:1,pgLit:.4}}};}
test('only audited material usage determines required variant fields; PgBody4 negative sentinels survive exactly',()=>{
 const g=registry('source-glass',glass(),{aFkTr:[.8,.7,.6],aPgBody:[-1,-1,-1,-1]});const rows=buildSurfaceParameters(g);assert.deepEqual(rows.variants[0].pgBody,[-1,-1,-1,-1]);assert.deepEqual(rows.variants[0].fkTr,[.8,.7,.6]);assert.deepEqual(rows.variants[0].sgRect,[0,0,0,0]);
 delete g.variants[0].fields.aPgBody;assert.throws(()=>buildSurfaceParameters(g),/pgBody/);
 const unused=registry('source-standard',basic(),{});assert.doesNotThrow(()=>buildSurfaceParameters(unused));
 delete unused.variants[0].materials;assert.throws(()=>buildSurfaceParameters(unused),/usage audit/);
});
test('active source uniforms, original sampler matrices, and affine frame identity fail closed if absent or malformed',()=>{
 const g=registry('source-glass',glass(),{aFkTr:[1,1,1],aPgBody:[-1,-1,-1,-1]});delete g.materials[0].shader.uniforms.pgRm;assert.throws(()=>buildSurfaceParameters(g),/pgRm/);
 const b=registry('source-standard',basic());b.frames[0].combinedMatrix[0]=0;assert.throws(()=>buildSurfaceParameters(b),/combination|Singular/);
 const valid=buildSurfaceParameters(registry('source-standard',basic()));assert.deepEqual(valid.frames[0].combined0,[1,0,0,0]);assert.deepEqual(valid.frames[0].instanceTranslationXZ,[0,0]);
});

test('shared variants union audited consumers and require captured instance colors only when the source actually owns them',async()=>{
 const {SOURCE_VEGETATION_IDENTITIES}=await import('../../../packages/app/features/game/world/vd-port/blocks/source-vegetation-programs.ts');const p=SOURCE_VEGETATION_IDENTITIES[0];
 const leaf={...basic(),id:1,family:1,type:p.type,vertexColors:true,alphaTest:.5,emissive:[0,0,0],emissiveIntensity:1,roughness:.68,metalness:0,
   source:{key:p.key,shaderHash:p.hash,shaderSha256:p.sha256},textureBindings:{map:{}},shader:{attrs:[],uniforms:{vg37K:[.55,.6,0,0],uR14:[45,6.75,300,36],uOn14:1,uDith14:0}}};
 const r=registry('source-standard',basic());r.materialCount=2;r.materials.push(leaf);r.families.push({id:1,name:'source-vegetation',staticFlags:{textureRoles:[],vertexColors:true,hasAlphaTest:true}});r.variants[0].materials=[0,1];r.frames[0].isInstanced=true;r.frames[0].hasInstanceColor=true;
 assert.throws(()=>buildSurfaceParameters(r),/instanceColor/);
 r.variants[0].fields.instanceColor=[.3,.6,.9];const exact=buildSurfaceParameters(r);assert.deepEqual(exact.variants[0].instanceColor,[.3,.6,.9]);
 delete r.variants[0].fields.instanceColor;r.frames[0].hasInstanceColor=false;assert.deepEqual(buildSurfaceParameters(r).variants[0].instanceColor,[1,1,1],'explicit absent source instance color is identity');
});

test('mapped families retain original matrix columns/layer and reject unbound explicit environments',()=>{
 const p=SOURCE_STANDARD_PROGRAMS.cd0dc17f,m={...basic(),type:p.type,emissive:[0,0,0],emissiveIntensity:1,roughness:.8,metalness:0,source:{key:p.key,shaderHash:'cd0dc17f',shaderSha256:p.sha256},textureBindings:{map:{matrix:[2,0,0,0,.7,0,.13,.21,1],layer:0}}};
 const r=registry('source-standard',m);r.families[0].staticFlags.textureRoles=['map'];
 const exact=buildSurfaceParameters(r).families[0].materials[0].values;
 assert.deepEqual(exact.mapUv0,[2,0,0]);assert.deepEqual(exact.mapUv1,[0,.7,0]);assert.deepEqual(exact.mapUv2,[.13,.21,1]);assert.equal(exact.mapLayer,0);
 m.textureBindings.map.matrix.pop();assert.throws(()=>buildSurfaceParameters(r),/Unbound original texture map/);
 m.textureBindings.map.matrix.push(1);m.environment.hasMaterialEnvMap=true;assert.throws(()=>buildSurfaceParameters(r),/environment map/);
});
