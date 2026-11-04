import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as THREE from 'three/webgpu';
import {createSourceStandardFamily,classifySourceStandard,sourceStandardParameterSchema,SOURCE_STANDARD_PROGRAMS,type SourceStandardIdentity} from './source-standard-family.ts';
import {createMaterialTable,packParameterRows} from './material-table.ts';
import {sourceParameterBinding} from './source-bindings.ts';
import {sourceEnvironmentNodes} from './source-environment.ts';
import type {SourceRenderState} from './source-standard.ts';
import {installGpuGlobals,recordingCanvas,recordingGpuDevice} from '../../../render-runtime/recording-gpu.test-support.ts';
const state:SourceRenderState={fog:true,side:THREE.DoubleSide,flatShading:false,transparent:false,depthWrite:true,depthTest:true,colorWrite:true,blending:THREE.NormalBlending,blendSrc:THREE.SrcAlphaFactor,blendDst:THREE.OneMinusSrcAlphaFactor,blendSrcAlpha:null,blendDstAlpha:null,blendEquation:THREE.AddEquation,blendEquationAlpha:null,premultipliedAlpha:false,alphaHash:false,alphaToCoverage:false,polygonOffset:false,polygonOffsetFactor:0,polygonOffsetUnits:0};
function source(hash:keyof typeof SOURCE_STANDARD_PROGRAMS,roles:readonly string[]):SourceStandardIdentity{const p=SOURCE_STANDARD_PROGRAMS[hash];return{key:p.key,shaderHash:hash,shaderSha256:p.sha256,type:p.type,vertexColors:false,hasAlphaTest:roles.includes('alphaMap'),mapRoles:roles,attributeRoles:[],...(roles.includes('normalMap')?{normalMapType:0}:{})};}
const row={diffuse:[0.7,0.6,0.5],opacity:1,alphaTest:0.5,emissive:[0,0,0],emissiveIntensity:1,roughness:0.5,metalness:0.4,envMapIntensity:1,normalScale:[1.5,0.7]};
test('six generic source templates accept only captured map/color/alpha/normal contracts',()=>{
 for(const hash of Object.keys(SOURCE_STANDARD_PROGRAMS) as(keyof typeof SOURCE_STANDARD_PROGRAMS)[]){const p=SOURCE_STANDARD_PROGRAMS[hash];for(const roles of p.mapSets)assert.ok(classifySourceStandard(source(hash,roles)));}
 assert.throws(()=>classifySourceStandard({...source('de0080f',['map']),shaderSha256:'0'.repeat(64)}),/Unverified/);
 assert.throws(()=>classifySourceStandard(source('de0080f',['displacementMap'])),/mismatch/);
 assert.throws(()=>classifySourceStandard({...source('a3dd8b4b',['map','normalMap']),normalMapType:1}),/normal map type/);
});
test('captured generic map combinations compile real Basic/Standard pipelines with derivative normals and city hooks',async()=>{
 installGpuGlobals();const{device,record}=recordingGpuDevice();const renderer=new THREE.WebGPURenderer({canvas:recordingCanvas(32,32),device}as never);await renderer.init();
 const T=THREE.TSL,night=T.uniform(0),env=sourceEnvironmentNodes(THREE,night),scene=new THREE.Scene(),geometry=new THREE.PlaneGeometry();
 geometry.setAttribute('aVdSurface',new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position!.count*4),4));
 geometry.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position!.count*3).fill(0.8),3));
 const texture=new THREE.DataTexture(new Uint8Array([128,190,220,255]),1,1);texture.needsUpdate=true;
 const materials=[],tables=[];
 for(const hash of Object.keys(SOURCE_STANDARD_PROGRAMS) as(keyof typeof SOURCE_STANDARD_PROGRAMS)[]){const p=SOURCE_STANDARD_PROGRAMS[hash];for(const roles of p.mapSets){
   const identity=source(hash,roles),schema=sourceStandardParameterSchema(identity),table=createMaterialTable(THREE,packParameterRows('generic-'+hash,schema.material,[row]));tables.push(table);
   const material=sourceParameterBinding(table,schema.material,T.varying(T.attribute('aVdSurface','vec4').x).setInterpolation('flat'));
   const m=createSourceStandardFamily(THREE,{name:hash,source:identity,state,material,rawUv:T.attribute('uv','vec2'),rawColor:T.attribute('color','vec3'),textures:{uv:(_,uv)=>uv.mul(THREE.TSL.vec2(2,0.7)),sample:(_,uv)=>T.texture(texture,uv)},
     common:{trim:{...env,scale:T.vec3(1)},cityAo:{position:T.positionWorld,normal:T.normalWorld,sample:T.vec2(0.8,0),rect:T.vec4(0,0,1,1),amount:env.cityAOAmt,lb14Gao:env.lb14Gao,night},cityReflection:{...env,height:T.positionWorld.y,pbrCity:false}}});
   assert.equal(m instanceof THREE.MeshBasicNodeMaterial,p.type==='MeshBasicMaterial');materials.push(m);scene.add(new THREE.Mesh(geometry,m));
 }}
 scene.add(new THREE.HemisphereLight());const camera=new THREE.PerspectiveCamera(60,1,0.1,100);camera.position.z=3;renderer.render(scene,camera);
 assert.ok(record.shaders.some(s=>s.includes('dpdx')),'normal-map derivative TBN compiles');assert.ok(record.shaders.some(s=>s.includes('discard')),'authored alpha-map coverage survives');
 const count=record.renderPipelines;night.value=1;renderer.render(scene,camera);assert.equal(record.renderPipelines,count);
 for(const m of materials)m.dispose();for(const t of tables)t.dispose();geometry.dispose();texture.dispose();renderer.dispose();
});
