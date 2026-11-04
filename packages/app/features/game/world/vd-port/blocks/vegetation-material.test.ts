import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { applyVegetationSpecular, sourceVegetationProgram, vegetationColorNode, vegetationFadeMask, vegetationNormalNode, vegetationSnowNodes, vegetationTranslucencyNode, vegetationWindDelta } from './vegetation-material.ts';
import { sourceVegetationFrameNodes } from './source-frame.ts';
import { installGpuGlobals, recordingCanvas, recordingGpuDevice } from '../../../render-runtime/recording-gpu.test-support.ts';

test('only both observed VG37 source fade variants are accepted', () => {
  const key = 'vg37leaf5|snowcap0.6true|cityaon|cs34|lighttrim2.6,2.6,2.6|st34|lf14';
  assert.equal(sourceVegetationProgram(`${key}0`, '1421a5c1'), 0);
  assert.equal(sourceVegetationProgram(`${key}1`, '1421a5c1'), 1);
  assert.throws(() => sourceVegetationProgram(`${key}2`, '1421a5c1'), /Unsupported/);
  assert.throws(() => sourceVegetationProgram(`${key}0`, 'changed'), /Unsupported/);
});

test('source leaf tint, derivative normals, snow, fade and both wind paths compile without frame-dependent pipelines', async () => {
  installGpuGlobals();
  const { device, record } = recordingGpuDevice();
  const renderer = new THREE.WebGPURenderer({ canvas: recordingCanvas(32, 32), device } as never);
  await renderer.init();
  const T = THREE.TSL, instanceFlag = T.uniform(1), time = T.uniform(0), snow = T.uniform(0), camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100); camera.position.z = 4;
  const geometry = new THREE.BoxGeometry(), scene = new THREE.Scene(), materials: THREE.MeshStandardNodeMaterial[] = [];
  const atlas = new THREE.DataTexture(new Uint8Array([128, 128, 255, 160]), 1, 1); atlas.needsUpdate = true;
  class LeafLighting extends THREE.PhysicalLightingModel {
    override start(builder: Parameters<THREE.PhysicalLightingModel['start']>[0]) {
      applyVegetationSpecular(THREE);
      super.start(builder);
    }
  }
  for (const instanced of [true, false, instanceFlag]) for (const level of [0, 1] as const) {
    const material = new THREE.MeshStandardNodeMaterial();
    material.setupLightingModel = () => new LeafLighting();
    const sample = T.texture(atlas, T.uv());
    const frame = sourceVegetationFrameNodes(THREE, {position:T.positionLocal, normal:T.normalLocal, frame:{
      scalar: name => name === 'isInstanced' ? instanceFlag : T.float(0),
      vec2: () => T.vec2(300,1400), vec3: () => { throw new Error('Unexpected frame field'); },
      vec4: name => name === 'affine' ? T.vec4(1,1,0,0) : T.vec4(...([0,1,2,3].map(i => i === Number(name.at(-1)) ? 1 : 0) as [number,number,number,number])),
    }});
    const color = vegetationColorNode(THREE, T.vec3(0.2, 0.4, 0.1), T.vec3(0.8, 0.4, 0.6));
    const capped = vegetationSnowNodes(THREE, color, T.float(0.68), T.normalViewGeometry, snow);
    material.colorNode = capped.color; material.roughnessNode = capped.roughness;
    material.normalNode = vegetationNormalNode(THREE, T.normalViewGeometry, T.positionView, T.uv(), sample, T.float(0.55));
    material.positionNode = T.positionLocal.add(frame.sceneWindDelta(vegetationWindDelta(THREE, {
      localPosition: frame.localPosition, objectNormal: frame.objectNormal, instanceTranslation: frame.instanceTranslation, instanced, time, amplitude: T.float(0.35),
    })));
    material.emissiveNode = vegetationTranslucencyNode(THREE, T.vec3(0.3), T.vec3(0, 1, 0), T.positionViewDirection, color, T.float(0.6), sample.a);
    material.maskNode = vegetationFadeMask(THREE, { origin: T.vec2(0), camera: T.vec2(0, 20), ranges: T.vec4(45, 6.75, 300, 36), enabled: T.float(1), frame: time, screenPosition: T.screenCoordinate.xy, level });
    materials.push(material); scene.add(new THREE.Mesh(geometry, material));
  }
  renderer.render(scene, camera);
  assert.ok(record.shaders.some((source) => source.includes('6.7')));
  assert.ok(record.shaders.some((source) => source.includes('52.9829189')));
  const pipelines = record.renderPipelines;
  time.value = 13; snow.value = 1; instanceFlag.value = 0; renderer.render(scene, camera);
  assert.equal(record.renderPipelines, pipelines);
  for (const material of materials) material.dispose();
  geometry.dispose(); atlas.dispose(); renderer.dispose();
});
