import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { createSourceStandardMaterial, type SourceRenderState } from './source-standard.ts';
import { createSourceLightingModel, sourceLightCapture } from './source-lighting.ts';
import { sourceEnvironmentNodes } from './source-environment.ts';
import { installGpuGlobals, recordingCanvas, recordingGpuDevice } from '../../../render-runtime/recording-gpu.test-support.ts';

const state: SourceRenderState = {
  fog: true,
  side: THREE.DoubleSide, transparent: true, depthWrite: false, depthTest: true, colorWrite: true,
  blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  blendSrcAlpha: null, blendDstAlpha: null, blendEquation: THREE.AddEquation, blendEquationAlpha: null,
  premultipliedAlpha: false, alphaHash: false, alphaToCoverage: false,
  polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
};

test('shared authored standard factory compiles source alpha/output state without a second premultiply', async () => {
  installGpuGlobals();
  const { device, record } = recordingGpuDevice();
  const renderer = new THREE.WebGPURenderer({ canvas: recordingCanvas(32, 32), device } as never);
  await renderer.init();
  const T = THREE.TSL, opacity = T.uniform(0.6), environmentIntensity = T.uniform(0.25);
  const sourceEnv = sourceEnvironmentNodes(THREE, T.uniform(0));
  const capture = sourceLightCapture(THREE);
  const material = createSourceStandardMaterial(THREE, { name: 'test:source-family', state,
    envMapIntensityNode: environmentIntensity,
    lightingModel: () => createSourceLightingModel(THREE, {
      trim: { ...sourceEnv, scale: T.vec3(1) }, interior: { indirect: T.float(0.6), direct: T.float(0.85) },
      cityReflection: { height: T.positionWorld.y, ...sourceEnv, pbrCity: true }, capture,
    }),
    surface: {
      color: T.vec3(1, 0.3, 0.1), opacity, emission: T.vec3(0.2), roughness: T.float(0.4), metalness: T.float(0),
      hasAlphaTest: true, alphaTest: T.uniform(0.02), beforeFog: (rgba) => T.vec4(T.max(rgba.rgb.sub(capture.totalSpecular), 0).mul(rgba.a), rgba.a),
    },
  });
  assert.equal(material.premultipliedAlpha, false, 'the authored pre-fog hook already premultiplies RGB');
  assert.equal(material.depthWrite, false);
  assert.equal(material.polygonOffsetFactor, -2);
  const scene = new THREE.Scene(), geometry = new THREE.PlaneGeometry();
  scene.add(new THREE.Mesh(geometry, material), new THREE.HemisphereLight());
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100); camera.position.z = 3;
  renderer.render(scene, camera);
  assert.ok(record.shaders.some((code) => code.includes('discard')), 'source alphaTest node emits coverage discard');
  const count = record.renderPipelines;
  opacity.value = 0.2;
  environmentIntensity.value = 1;
  renderer.render(scene, camera);
  assert.equal(record.renderPipelines, count, 'per-descriptor opacity does not create another pipeline');
  material.dispose(); geometry.dispose(); renderer.dispose();
});
