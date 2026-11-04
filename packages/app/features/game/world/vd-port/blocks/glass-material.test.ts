import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import type { Node } from 'three/webgpu';
import {
  evaluateSourceGlassComposite, sourceGlassProgram, SOURCE_GLASS_PROGRAMS, kitWindowGlassNodes, pbrGlassNodes,
  fkAtlasSample, fkEnvironmentSpecular, fkInteriorLighting, fkLevelEmission, fkNightEmission, fkSharedTint, fkSkyMetalNodes, fkSoftMap,
  type SourceGlassLighting, type SourceGlassEnvironment, type PbrGlassParameters,
} from './glass-material.ts';
import { installSourceOutputHook } from './source-output.ts';
import { installGpuGlobals, recordingCanvas, recordingGpuDevice } from '../../../render-runtime/recording-gpu.test-support.ts';

const near = (a: readonly number[], b: readonly number[]) => a.forEach((value, i) => assert.ok(Math.abs(value - b[i]!) < 1e-10, `${a} != ${b}`));
test('sampled source compositing keeps premultiplied pane reflection and removes the duplicate stock specular', () => {
  const values = { outgoing: [4, 2, 1], totalSpecular: [2, 1, 0.5], indirectDiffuse: [0.6, 0.4, 0.2], directDiffuse: [2, 1, 0.5], emission: [0.1, 0, 0], reflection: [0.1, 0.2, 0.3], interior: [1, 0.5, 0.25], opacity: 0.36, fresnel: 0.2 };
  const kit = evaluateSourceGlassComposite(values, 'kit', true);
  near(kit.color, [0.82, 0.56, 0.48]);
  assert.equal(kit.alpha, 0.488);
  const transparent = evaluateSourceGlassComposite(values, 'transparent', true);
  near(transparent.color, kit.color);
  near(evaluateSourceGlassComposite(values, 'transparent', false).color, [1.54, 0.92, 0.66]);
  near(evaluateSourceGlassComposite(values, 'room', true).color, [1.06, 0.68, 0.54]);
  near(evaluateSourceGlassComposite(values, 'body', true).color, [1.7, 1.04, 0.72]);
  near(evaluateSourceGlassComposite(values, 'body', false).color, [3.3, 1.84, 1.12]);
  const clear = evaluateSourceGlassComposite({ ...values, opacity: 0 }, 'kit', true);
  near(clear.color, values.reflection); assert.equal(clear.alpha, 0.2, 'reflection remains when body transmission is clear');
  assert.equal(evaluateSourceGlassComposite({ ...values, opacity: 2 }, 'kit', true).alpha, 1);
});

test('only census-proven authored glass branches are accepted', () => {
  for (const [key, hash] of Object.entries(SOURCE_GLASS_PROGRAMS)) assert.equal(sourceGlassProgram(key, hash), key);
  assert.throws(() => sourceGlassProgram('pbrglass4|t|rm', '8dd43f3e'), /Unsupported/);
  assert.throws(() => sourceGlassProgram('kitwinglass3|0.2|0.03|0.3|0.26', 'modified'), /Unsupported/);
});

test('kit and each PBR glass branch compile native WGSL with captured lighting and stable authored world patterns', async () => {
  installGpuGlobals();
  const { device, record } = recordingGpuDevice();
  const renderer = new THREE.WebGPURenderer({ canvas: recordingCanvas(32, 32), device } as never);
  await renderer.init();
  const T = THREE.TSL, night = T.uniform(0);
  const environment: SourceGlassEnvironment = { night, reflectionGain: T.float(1), sunDirection: T.vec3(-0.55, 0.77, 0.33), sunColor: T.vec3(1, 0.93, 0.82), zenith: T.vec3(0.5, 0.6, 0.75), horizon: T.vec3(0.78, 0.83, 0.9) };
  const parameters: PbrGlassParameters = { f0: T.float(0.1), roughness: T.float(0.03), dirt: T.float(0.1), streetWidth: T.float(30.5), body: T.vec3(0.014, 0.017, 0.021), room: T.vec4(5.1, 0, 11, 1.6), blinds: T.float(0.3), transmission: T.float(0.45), seed: T.float(606), sheers: T.float(0.3), glow: T.float(0.05), storeyLocked: T.float(1), litShare: T.float(0.4), origin: T.vec3(0) };
  const geometry = new THREE.BoxGeometry();
  const materialList: THREE.MeshStandardNodeMaterial[] = [];
  const scene = new THREE.Scene(); scene.fog = new THREE.Fog(0xaaaaaa, 2, 30);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100); camera.position.set(0, 1, 4);
  for (const mode of ['kit', 'transparent-street', 'opaque-street', 'room-street', 'opaque-attributes', 'room', 'opaque'] as const) {
    const material = new THREE.MeshStandardNodeMaterial();
    const captures: SourceGlassLighting = { outgoing: T.property('vec3', 'glassOutgoing'), totalSpecular: T.property('vec3', 'glassSpecular'), indirectDiffuse: T.property('vec3', 'glassIndirect'), directDiffuse: T.property('vec3', 'glassDirect'), emission: T.property('vec3', 'glassEmission') };
    class GlassLighting extends THREE.PhysicalLightingModel {
      override finish(builder: Parameters<THREE.PhysicalLightingModel['finish']>[0]) {
        super.finish(builder);
        const c = builder.context as { outgoingLight: Node<'vec3'>; reflectedLight: { directDiffuse: Node<'vec3'>; indirectDiffuse: Node<'vec3'>; directSpecular: Node<'vec3'>; indirectSpecular: Node<'vec3'> } };
        captures.outgoing.assign(c.outgoingLight);
        captures.totalSpecular.assign(c.reflectedLight.directSpecular.add(c.reflectedLight.indirectSpecular));
        captures.indirectDiffuse.assign(c.reflectedLight.indirectDiffuse); captures.directDiffuse.assign(c.reflectedLight.directDiffuse);
        captures.emission.assign(T.vec3(0.01));
      }
    }
    material.setupLightingModel = () => new GlassLighting();
    const frame = { position: T.positionWorld, cameraPosition: T.cameraPosition, normal: T.normalWorld };
    const glass = mode === 'kit' ? kitWindowGlassNodes(THREE, { ...frame, environment, tint: T.vec3(0.8, 0.9, 0.85), character: T.vec3(0.7, 0.3, 0.9), opacity: T.float(0.36), f0: T.float(0.2), roughness: T.float(0.03), dirt: T.float(0.3) })
      : pbrGlassNodes(THREE, { ...frame, environment, parameters, geometricNormal: T.normalWorldGeometry, groundHeight: T.float(0), tint: T.vec3(0.6, 0.75, 0.7), tintRatio: T.vec3(0.8, 1, 1.2), bodyOverride: T.vec4(-1), opacity: T.float(0.25), opaque: mode !== 'transparent-street', street: mode.includes('street') || mode === 'opaque-attributes', room: mode.includes('room'), tintAttributes: mode === 'opaque-attributes' });
    material.colorNode = glass.color; material.opacityNode = glass.opacity; material.roughnessNode = parameters.roughness;
    material.transparent = mode === 'kit' || mode === 'transparent-street'; material.depthWrite = !material.transparent;
    if (material.transparent) { material.blending = THREE.CustomBlending; material.blendSrc = material.blendSrcAlpha = THREE.OneFactor; material.blendDst = material.blendDstAlpha = THREE.OneMinusSrcAlphaFactor; }
    assert.equal(material.premultipliedAlpha, false, 'source output is already premultiplied; do not multiply it twice');
    installSourceOutputHook(material, () => glass.output(captures));
    materialList.push(material);
    const mesh = new THREE.Mesh(geometry, material); scene.add(mesh); renderer.render(scene, camera); scene.remove(mesh);
  }
  assert.ok(record.shaders.some(s => s.includes('0.50737') && s.includes('0.0981748')), 'geometric normal frame snap survives the port');
  assert.ok(record.shaders.some(s => s.includes('0.089') && s.includes('0.06')), 'original shade/blind periods reach the shader');
  assert.ok(record.shaders.some(s => s.includes('0.035')));
  const pipelines = record.renderPipelines;
  night.value = 1; scene.add(new THREE.Mesh(geometry, materialList[0])); renderer.render(scene, camera);
  assert.equal(record.renderPipelines, pipelines);
  for (const m of materialList) m.dispose(); geometry.dispose(); renderer.dispose();
});

test('FK atlas gradients, shared tint, room lighting, sky-metal and emission hooks compile together', async () => {
  installGpuGlobals(); const { device, record } = recordingGpuDevice();
  const renderer = new THREE.WebGPURenderer({ canvas: recordingCanvas(16, 16), device } as never); await renderer.init();
  const T = THREE.TSL, material = new THREE.MeshStandardNodeMaterial();
  const atlas = new THREE.DataTexture(new Uint8Array([200, 160, 120, 255]), 1, 1); atlas.minFilter = THREE.LinearMipmapLinearFilter; atlas.magFilter = THREE.LinearFilter; atlas.generateMipmaps = true; atlas.needsUpdate = true;
  const sample = fkAtlasSample(THREE, T.uv(), T.vec3(0.5, 0.25, 0.5), T.float(8), (uv, dx, dy) => T.texture(atlas, uv).grad(dx, dy));
  const diffuse = fkSoftMap(THREE, fkSharedTint(T.vec3(0.5), T.vec3(0.8, 1.1, 1.2)), sample.rgb, T.float(0.2));
  material.colorNode = diffuse;
  const env: SourceGlassEnvironment = { night: T.uniform(0.5), reflectionGain: T.float(1), sunDirection: T.vec3(0, 1, 0), sunColor: T.vec3(1), zenith: T.vec3(0.5), horizon: T.vec3(0.8) };
  const sky = fkSkyMetalNodes(THREE, { position: T.positionWorld, cameraPosition: T.cameraPosition, normal: T.normalWorldGeometry }, env, T.vec3(0.8), T.vec4(0.12, 0.7, 1, 0.12), T.float(0.38));
  material.emissiveNode = fkNightEmission(THREE, fkLevelEmission(THREE, diffuse, T.float(0.5), T.float(0.16), T.float(1.25), env.night), env.night, T.float(1)).add(sky.emission);
  material.roughnessNode = sky.roughness;
  const scale = fkInteriorLighting(THREE, { indirectDiffuse: T.vec3(1), indirectSpecular: T.vec3(1), directDiffuse: T.vec3(1), directSpecular: T.vec3(1) }, T.float(0.3), T.float(0.7));
  assert.ok(fkEnvironmentSpecular(scale.indirectSpecular, T.float(0.6)).isNode);
  const geometry = new THREE.BoxGeometry(), scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(); camera.position.z = 4;
  scene.add(new THREE.Mesh(geometry, material)); renderer.render(scene, camera);
  assert.ok(record.shaders.some(s => s.includes('textureSampleGrad')));
  geometry.dispose(); material.dispose(); atlas.dispose(); renderer.dispose();
});
