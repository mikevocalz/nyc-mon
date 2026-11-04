import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { createSourceTemplateCompiler } from './source-template-compiler.ts';
import { installGpuGlobals, recordingCanvas, recordingGpuDevice } from './render-runtime/recording-gpu.test-support.ts';
const deferred = () => { let resolve!:()=>void;const promise=new Promise<void>(r=>{resolve=r;});return{promise,resolve}; };
test('compilation restores live render state before waiting and serializes cancellation',async()=>{
 const active=deferred(),calls:unknown[]=[];const prior={name:'prior'},target={name:'source'},mrt={name:'mrt'};
 let current:unknown=prior,currentMrt:unknown=null,face=2,mip=3;
 const renderer={getRenderTarget:()=>current,getMRT:()=>currentMrt,getActiveCubeFace:()=>face,getActiveMipmapLevel:()=>mip,
  setRenderTarget:(v:unknown,f=0,m=0)=>{current=v;face=f;mip=m;},setMRT:(v:unknown)=>{currentMrt=v;},
  compileAsync:(group:THREE.Group,_camera:THREE.Camera,scene:THREE.Scene)=>{
   assert.equal(current,target);assert.equal(currentMrt,mrt);assert.ok(scene.isScene);assert.equal(group.children[0]!.frustumCulled,false);calls.push(group);return active.promise;
  }};
 const compiler=createSourceTemplateCompiler(THREE,renderer as never,new THREE.Scene(),new THREE.PerspectiveCamera(),{renderTarget:target,getMRT:()=>mrt} as never);
 const template=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardNodeMaterial());template.visible=false;
 const firstSignal=new AbortController(),secondSignal=new AbortController();
 const first=compiler.prepare([template],firstSignal.signal),second=compiler.prepare([],secondSignal.signal);
 const rejected=assert.rejects(second,{name:'AbortError'});secondSignal.abort();
 await Promise.resolve();assert.equal(calls.length,1);assert.equal(current,prior);assert.equal(currentMrt,null);assert.equal(face,2);assert.equal(mip,3);
 // r187 re-applies the compile context while processing later cooperative work items.
 current=target;currentMrt=mrt;compiler.beforeFrame();assert.equal(current,prior);assert.equal(currentMrt,null);
 firstSignal.abort();const firstRejected=assert.rejects(first,{name:'AbortError'});active.resolve();await firstRejected;await rejected;
 assert.equal(calls.length,1);assert.equal(template.parent,null);assert.equal(template.visible,false);assert.equal(template.frustumCulled,true);
 compiler.dispose();template.geometry.dispose();template.material.dispose();
});
test('detached authentic templates precompile against the actual scene and MRT',async()=>{
 installGpuGlobals();const {device,record}=recordingGpuDevice();const renderer=new THREE.WebGPURenderer({canvas:recordingCanvas(16,16),device,reversedDepthBuffer:true} as never);await renderer.init();
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(60,1,0.1,100);camera.position.z=4;const light=new THREE.DirectionalLight();light.castShadow=true;scene.add(light);renderer.shadowMap.enabled=true;
 const target=new THREE.RenderTarget(16,16,{count:2,type:THREE.HalfFloatType}),mrt=THREE.TSL.mrt({output:THREE.TSL.output,normal:THREE.TSL.normalView});
 const material=new THREE.MeshStandardNodeMaterial({polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-3}),geometry=new THREE.BoxGeometry(),template=new THREE.Mesh(geometry,material);
 template.castShadow=true;template.receiveShadow=true;
 const compiler=createSourceTemplateCompiler(THREE,renderer,scene,camera,{renderTarget:target,getMRT:()=>mrt} as never);
 await compiler.prepare([template],new AbortController().signal);assert.equal(template.parent,null);assert.equal(renderer.getRenderTarget(),null);assert.equal(renderer.getMRT(),null);
 assert.equal(material.polygonOffsetFactor,2);assert.equal(material.polygonOffsetUnits,3);
 const compiled=record.renderPipelines;assert.ok(compiled>0);
 scene.add(template);renderer.setRenderTarget(target);renderer.setMRT(mrt);renderer.render(scene,camera);
 assert.equal(record.renderPipelines,compiled,'attached draw reuses the authentic MRT pipeline');
 scene.remove(template);await compiler.prepare([template],new AbortController().signal);assert.equal(material.polygonOffsetFactor,2);assert.equal(material.polygonOffsetUnits,3);
 compiler.dispose();material.dispose();geometry.dispose();target.dispose();renderer.dispose();
});
test('closing an active compiler drains native work before destructive cleanup',async()=>{
 const active=deferred();let destroyed=false;
 const renderer={getRenderTarget:()=>null,getMRT:()=>null,getActiveCubeFace:()=>0,getActiveMipmapLevel:()=>0,setRenderTarget:()=>{},setMRT:()=>{},
  compileAsync:()=>active.promise.then(()=>{assert.equal(destroyed,false);})};
 const compiler=createSourceTemplateCompiler(THREE,renderer as never,new THREE.Scene(),new THREE.PerspectiveCamera(),null);
 const template=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardNodeMaterial());
 const pending=compiler.prepare([template],new AbortController().signal);const rejected=assert.rejects(pending,{name:'AbortError'});
 await Promise.resolve();const drain=compiler.dispose();assert.ok(drain instanceof Promise);
 const cleanup=Promise.resolve(drain).then(()=>{destroyed=true;});await Promise.resolve();assert.equal(destroyed,false);
 await assert.rejects(compiler.prepare([],new AbortController().signal),{name:'AbortError'});
 active.resolve();await rejected;await cleanup;assert.equal(destroyed,true);assert.equal(template.parent,null);
 template.geometry.dispose();template.material.dispose();
});
