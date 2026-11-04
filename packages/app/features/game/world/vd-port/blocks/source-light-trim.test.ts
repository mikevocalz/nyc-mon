import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import type { Node } from 'three/webgpu';
import { applySourceSpecularTrim, sourceDiffuseTrim } from './source-light-trim.ts';
import { sourceCityAoFactors } from './source-city-ao.ts';
import { sourceCityReflection } from './source-city-reflection.ts';
import { sourceEnvironmentNodes } from './source-environment.ts';
import { installGpuGlobals, recordingCanvas, recordingGpuDevice } from '../../../render-runtime/recording-gpu.test-support.ts';

test('authored diffuse/ST34 trim composes with installed physical lighting before scattering', async () => {
  installGpuGlobals();
  const { device, record } = recordingGpuDevice();
  const renderer = new THREE.WebGPURenderer({ canvas: recordingCanvas(32, 32), device } as never);
  await renderer.init();
  const night = THREE.TSL.uniform(0);
  const sourceEnv = sourceEnvironmentNodes(THREE, night);
  const inputs = { ...sourceEnv, scale: THREE.TSL.uniform(new THREE.Vector3(1.94, 1.7, 1.47)) };
  const material = new THREE.MeshStandardNodeMaterial();
  material.colorNode = THREE.TSL.vec3(0.4).mul(sourceDiffuseTrim(THREE, inputs));
  const ao = sourceCityAoFactors(THREE, {
    position: THREE.TSL.positionWorld, normal: THREE.TSL.normalWorldGeometry,
    sample: THREE.TSL.uniform(new THREE.Vector2(0.3, 0.05)),
    rect: THREE.TSL.uniform(new THREE.Vector4(0, 0, 1, 1)),
    amount: sourceEnv.cityAOAmt, lb14Gao: sourceEnv.lb14Gao, night: inputs.night,
  });
  const { cs34, cs34Col } = sourceEnv;
  let starts = 0;
  class SourceLighting extends THREE.PhysicalLightingModel {
    override start(builder: Parameters<THREE.PhysicalLightingModel['start']>[0]) {
      starts++;
      applySourceSpecularTrim(THREE, inputs);
      super.start(builder);
    }
    override ambientOcclusion(builder: Parameters<THREE.PhysicalLightingModel['ambientOcclusion']>[0]) {
      super.ambientOcclusion(builder);
      const context = builder.context as { reflectedLight: { indirectDiffuse: Node<'vec3'>; indirectSpecular: Node<'vec3'> } };
      context.reflectedLight.indirectDiffuse.mulAssign(ao.diffuse);
      context.reflectedLight.indirectSpecular.mulAssign(ao.specular);
    }
    override indirect(builder: Parameters<THREE.PhysicalLightingModel['indirect']>[0]) {
      const context = builder.context as { radiance: Node<'vec3'>; iblIrradiance: Node<'vec3'> };
      const reflection = sourceCityReflection(THREE, {
        height: ao.height, radiance: context.radiance, iblIrradiance: context.iblIrradiance,
        cs34, cs34Col, pbrCity: THREE.TSL.float(0),
      });
      context.radiance.assign(reflection.radiance);
      context.iblIrradiance.assign(reflection.iblIrradiance);
      super.indirect(builder);
    }
  }
  material.setupLightingModel = () => new SourceLighting();
  const scene = new THREE.Scene();
  const geometry = new THREE.BoxGeometry();
  scene.add(new THREE.Mesh(geometry, material), new THREE.HemisphereLight(), new THREE.DirectionalLight());
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  camera.position.z = 4;
  renderer.render(scene, camera);
  assert.equal(starts, 1);
  assert.ok(record.shaders.some((s) => s.includes('smoothstep') && s.includes('0.12') && s.includes('0.28')));
  assert.ok(record.shaders.some((s) => s.includes('127.5') && s.includes('46.0')), 'authored visibility/terrain height ramp reaches WGSL');
  const pipelineCount = record.renderPipelines;
  night.value = 1;
  renderer.render(scene, camera);
  assert.equal(record.renderPipelines, pipelineCount, 'day/night changes reuse the authored family pipeline');
  geometry.dispose(); material.dispose(); renderer.dispose();
});
