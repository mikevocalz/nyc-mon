import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as THREE from 'three/webgpu';
import {createSourceTemplateCompiler} from './source-template-compiler.ts';
import {installGpuGlobals,recordingCanvas,recordingGpuDevice} from './render-runtime/recording-gpu.test-support.ts';

// Regression for pinned Three0.187.0: async override work previously lost its
// source material and per-source nodes after render-list traversal restored them.
test('PCF async compilation preserves source alpha, position, displacement and side across scoped work',async()=>{
 installGpuGlobals();const {device,record}=recordingGpuDevice();
 const renderer=new THREE.WebGPURenderer({canvas:recordingCanvas(16,16),device,reversedDepthBuffer:true} as never);await renderer.init();
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(60,1,.1,100);camera.position.z=4;
 const sun=new THREE.DirectionalLight();sun.castShadow=true;scene.add(sun);
 const target=new THREE.RenderTarget(16,16,{count:2,type:THREE.HalfFloatType});
 const mrt=THREE.TSL.mrt({output:THREE.TSL.output,normal:THREE.TSL.normalView});
 const textures=[0,1].map(i=>{const texture=new THREE.DataTexture(new Uint8Array([128+i,180,220,255]),1,1);texture.needsUpdate=true;return texture;});
 const templates=[0,1].map(i=>{
  const material=new THREE.MeshStandardNodeMaterial({side:i?THREE.DoubleSide:THREE.FrontSide,shadowSide:i?THREE.BackSide:THREE.DoubleSide,alphaTest:.5,alphaMap:textures[i],displacementMap:textures[i],displacementScale:.1+i*.1,displacementBias:i*.02});
  const T=THREE.TSL;
  material.colorNode=T.vec4(T.vec3(.4),i?T.uv().y:T.uv().x);
  material.positionNode=T.positionLocal.add(i?T.vec3(T.uv().y.mul(.1),0,0):T.vec3(0,T.uv().x.mul(.1),0)).toVar(i?'sourcePositionB':'sourcePositionA');
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(),material);mesh.castShadow=true;mesh.receiveShadow=true;return mesh;
 });
 type State={item:null|{sourceMaterial:unknown;material:Record<string,unknown>;overrideMaterialState:Record<string,unknown>|null}};
 const internal=renderer as unknown as {_currentSourceMaterial:unknown;_beginPreCompile(state:State):void;_finishPreCompile():void};
 const begin=internal._beginPreCompile.bind(internal),finish=internal._finishPreCompile.bind(internal);
 let overridden=0,restored=0;
 internal._beginPreCompile=state=>{
  begin(state);
  if(state.item?.overrideMaterialState){overridden++;assert.equal(internal._currentSourceMaterial,state.item.sourceMaterial);
   for(const [name,value]of Object.entries(state.item.overrideMaterialState))assert.equal(state.item.material[name],value,`${name} restored for queued source`);
  }
 };
 internal._finishPreCompile=()=>{finish();assert.equal(internal._currentSourceMaterial,null,'source override cannot leak into a visible frame/yield');restored++;};
 const compiler=createSourceTemplateCompiler(THREE,renderer,scene,camera,{renderTarget:target,getMRT:()=>mrt} as never);
 try{
  await compiler.prepare(templates,new AbortController().signal);
  const compiled=record.renderPipelines;assert.equal(compiled,4,'two authored color and two exact shadow pipelines');
  assert.ok(overridden>=2);assert.ok(restored>=2);assert.equal(scene.overrideMaterial,null);
  assert.ok(record.shaders.some(code=>code.includes('sourcePositionA')));assert.ok(record.shaders.some(code=>code.includes('sourcePositionB')));
  scene.add(...templates);renderer.setRenderTarget(target);renderer.setMRT(mrt);renderer.render(scene,camera);
  assert.equal(record.renderPipelines,compiled,'first attached PCF draw must not create the previously missing two shadow pipelines');
  assert.equal(templates[0]!.material.side,THREE.FrontSide);assert.equal(templates[1]!.material.side,THREE.DoubleSide);
 }finally{await compiler.dispose();for(const mesh of templates){mesh.geometry.dispose();mesh.material.dispose();}for(const texture of textures)texture.dispose();target.dispose();await renderer.dispose();}
});
