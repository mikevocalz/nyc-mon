import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { createSourceVegetationMaterial } from './source-vegetation-factory.ts';
import { SOURCE_VEGETATION_IDENTITIES } from './source-vegetation-programs.ts';
import { installGpuGlobals, recordingCanvas, recordingGpuDevice } from '../../../render-runtime/recording-gpu.test-support.ts';

test('both strict leaf programs bind atlas relief, dynamic wind and directional translucency without diffuse LT', async () => {
  installGpuGlobals();
  const {device,record}=recordingGpuDevice(),renderer=new THREE.WebGPURenderer({canvas:recordingCanvas(32,32),device} as never);
  await renderer.init();
  const T=THREE.TSL,time=T.uniform(0),instance=T.uniform(1),night=T.uniform(0),scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(60,1,0.1,100);camera.position.z=4;
  const geometry=new THREE.BoxGeometry(),atlas=new THREE.DataTexture(new Uint8Array([90,140,60,255]),1,1);atlas.needsUpdate=true;
  const state={fog:true,side:THREE.DoubleSide,transparent:false,depthWrite:true,depthTest:true,colorWrite:true,blending:THREE.NormalBlending,
    blendSrc:THREE.SrcAlphaFactor,blendDst:THREE.OneMinusSrcAlphaFactor,blendSrcAlpha:null,blendDstAlpha:null,blendEquation:THREE.AddEquation,blendEquationAlpha:null,
    premultipliedAlpha:false,alphaHash:false,alphaToCoverage:false,polygonOffset:false,polygonOffsetFactor:0,polygonOffsetUnits:0};
  const binding={scalar:(name:string)=>T.float(name==='opacity'||name==='envMapIntensity'||name==='uOn14'?1:name==='roughness'?0.7:name==='alphaTest'?0.5:0),
    vec2:()=>T.vec2(0),vec3:(name:string)=>T.vec3(name==='emissive'?0:1),vec4:(name:string)=>name==='uR14'?T.vec4(45,6.75,300,36):T.vec4(0.55,0.6,0,0)};
  const materials=SOURCE_VEGETATION_IDENTITIES.map(identity=>createSourceVegetationMaterial(THREE,{
    name:'leaf-test',source:{key:identity.key,shaderHash:identity.hash,shaderSha256:identity.sha256,type:identity.type,vertexColors:true,hasAlphaTest:true,mapRoles:['map']},state,
    material:binding,variant:binding,textures:{uv:(_name,uv)=>uv,sample:(name,uv)=>{assert.ok(name==='map'||name==='vgNrm');return T.texture(atlas,uv);}},
    rawColor:T.vec3(0.4,0.7,0.2),rawUv:T.uv(),geometricNormalView:T.normalViewGeometry,
    frame:{localPosition:T.positionLocal,objectNormal:T.normalLocal,instanceTranslation:T.vec2(3,5),instanced:instance,sourceOrigin:T.vec2(0),sceneWindDelta:delta=>delta},
    dynamics:{windTime:time,windAmplitude:T.float(0.3),snow:T.float(0),fadeFrame:time,sourceCamera:T.vec2(0,20),bottomLeftScreenPixels:T.vec2(T.screenCoordinate.x,T.float(32).sub(T.screenCoordinate.y))},
    trim:{night,scale:T.vec3(2.6),st34:T.vec4(0.3,0,0,0)},
    cityAo:{position:T.positionWorld,normal:T.normalWorld,sample:T.vec2(1,0),rect:T.vec4(0),amount:T.float(1),lb14Gao:T.float(1),night},
    cityReflection:{height:T.positionWorld.y,cs34:T.vec4(0),cs34Col:T.vec4(0),pbrCity:false},
  }));
  for(const material of materials)scene.add(new THREE.Mesh(geometry,material));
  scene.add(new THREE.DirectionalLight(0xffffff,2),new THREE.PointLight(0x112233,1));
  renderer.render(scene,camera);const pipelines=record.renderPipelines;
  assert.ok(record.shaders.some(s=>s.includes('6.7')));assert.ok(record.shaders.some(s=>s.includes('52.9829189')));
  assert.ok(!record.shaders.some(s=>s.includes('2.6')),'the absent source diffuse LT must not be injected');
  time.value=4;instance.value=0;night.value=1;renderer.render(scene,camera);assert.equal(record.renderPipelines,pipelines);
  for(const material of materials)material.dispose();geometry.dispose();atlas.dispose();renderer.dispose();
});
