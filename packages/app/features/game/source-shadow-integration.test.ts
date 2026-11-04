import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as THREE from 'three/webgpu';
import {SunLight} from 'three/examples/jsm/lights/SunLight.js';
import {SunLightNode} from 'three/examples/jsm/lights/SunLightNode.js';
import {createSourceTemplateCompiler} from './source-template-compiler.ts';
import {createSoftShadowFilter} from './world/physical/soft-shadow-filter.ts';
import {installGpuGlobals,recordingCanvas,recordingGpuDevice} from './render-runtime/recording-gpu.test-support.ts';

async function fixture(){
 installGpuGlobals();const {device,record}=recordingGpuDevice();
 const renderer=new THREE.WebGPURenderer({canvas:recordingCanvas(32,32),device,reversedDepthBuffer:true} as never);await renderer.init();
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(60,1,.1,100);camera.position.set(0,3,6);camera.lookAt(0,0,0);camera.updateMatrixWorld();
 (SunLight as unknown as {registerNode(node:unknown):void}).registerNode(SunLightNode);
 const sun=new SunLight(0xfff2e3,3);sun.name='city:physical-sun';sun.position.set(.4,.8,.2).normalize();sun.castShadow=true;sun.shadow.mapSize.set(16,16);
 (sun.shadow as unknown as {filterNode:unknown}).filterNode=createSoftShadowFilter(THREE);
 scene.add(sun);scene.updateMatrixWorld();
 const target=new THREE.RenderTarget(32,32,{count:2,type:THREE.HalfFloatType});
 const mrt=THREE.TSL.mrt({output:THREE.TSL.output,normal:THREE.TSL.normalView});
 const compiler=createSourceTemplateCompiler(THREE,renderer,scene,camera,{renderTarget:target,getMRT:()=>mrt} as never);
 const views:THREE.Camera[]=[];const compile=renderer.compileAsync.bind(renderer);
 renderer.compileAsync=(object,view,targetScene,onProgress)=>{views.push(view);assert.equal(targetScene,scene);return compile(object,view,targetScene,onProgress);};
 return {renderer,record,scene,camera,sun,target,mrt,compiler,views,
  async dispose(meshes:THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardNodeMaterial>[]){await compiler.dispose();for(const mesh of meshes){mesh.geometry.dispose();mesh.material.dispose();}target.dispose();sun.dispose();await renderer.dispose();}};
}
function caster(receive=true){const mesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardNodeMaterial());mesh.castShadow=true;mesh.receiveShadow=receive;return mesh;}
function draw(f:Awaited<ReturnType<typeof fixture>>,meshes:THREE.Object3D[]){f.scene.add(...meshes);f.renderer.setRenderTarget(f.target);f.renderer.setMRT(f.mrt);f.renderer.render(f.scene,f.camera);}

test('actual game SunLight compiles both cascades and attached cast/receive draw reuses every pipeline',async()=>{
 const f=await fixture(),mesh=caster();
 try{
  await f.compiler.prepare([mesh],new AbortController().signal);
  assert.equal(f.sun.shadow.getViewportCount(),2);
  for(let i=0;i<2;i++)assert.ok(f.views.includes(f.sun.shadow.getCamera(i)),`actual cascade${i} camera compiled`);
  assert.notEqual(f.sun.shadow.getCamera(0),f.sun.shadow.getCamera(1));assert.ok(f.sun.shadow.map);
  const count=f.record.renderPipelines;assert.ok(count>=2);draw(f,[mesh]);assert.equal(f.record.renderPipelines,count);
  assert.equal(f.scene.overrideMaterial,null);assert.equal(mesh.visible,true);assert.equal(mesh.frustumCulled,true);
 }finally{await f.dispose([mesh]);}
});

test('caster-only templates initialize the real SunLight target through an actual scene receiver',async()=>{
 const f=await fixture(),mesh=caster(false),receiver=caster(true);receiver.castShadow=false;receiver.name='actual-ground-receiver';f.scene.add(receiver);
 try{
  assert.equal(f.sun.shadow.map,null);await f.compiler.prepare([mesh],new AbortController().signal);
  assert.ok(f.sun.shadow.map);assert.equal(receiver.parent,f.scene);assert.equal(receiver.frustumCulled,true);
  const count=f.record.renderPipelines;draw(f,[mesh]);assert.equal(f.record.renderPipelines,count,'actual receiver plus caster draw stays warm');
 }finally{await f.dispose([mesh,receiver]);}
});

test('patched Three preserves distinct alpha and source-specific positions through both SunLight cascades',async()=>{
 const f=await fixture(),meshes=[caster(),caster()];
 for(let i=0;i<meshes.length;i++){
  const material=meshes[i]!.material,T=THREE.TSL;
  material.alphaTest=.5;material.side=i?THREE.DoubleSide:THREE.FrontSide;material.shadowSide=i?THREE.BackSide:THREE.DoubleSide;
  material.colorNode=T.vec4(T.vec3(.4),i?T.uv().y:T.uv().x);
  material.positionNode=T.positionLocal.add(i?T.vec3(T.uv().y.mul(.1),0,0):T.vec3(0,T.uv().x.mul(.1),0));
 }
 try{
  await f.compiler.prepare(meshes,new AbortController().signal);
  const count=f.record.renderPipelines;assert.equal(count,4);draw(f,meshes);
  assert.equal(f.record.renderPipelines,count,'both source alpha graphs and shadow sides must match on first attached cascaded draw');
  assert.equal(f.scene.overrideMaterial,null);
 }finally{await f.dispose(meshes);}
});

test('caster-only target initialization chooses a receiver visible to the actual game camera layers',async()=>{
 const f=await fixture(),mesh=caster(false),decoy=caster(true),hidden=caster(true),receiver=caster(true);
 decoy.castShadow=false;receiver.castShadow=false;decoy.layers.set(3);decoy.name='excluded-layer-receiver';receiver.name='actual-layer-zero-receiver';
 hidden.castShadow=false;hidden.material.visible=false;hidden.name='hidden-material-receiver';
 f.scene.add(decoy,hidden,receiver);
 try{
  await f.compiler.prepare([mesh],new AbortController().signal);assert.ok(f.sun.shadow.map);
  const count=f.record.renderPipelines;draw(f,[mesh]);assert.equal(f.record.renderPipelines,count);
 }finally{await f.dispose([mesh,decoy,hidden,receiver]);}
});
