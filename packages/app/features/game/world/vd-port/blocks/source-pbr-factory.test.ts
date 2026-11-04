import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { createPilotPbrMaterial, createSourcePbrMaterial, classifyPilotPbr, classifySourcePbr, PBR_PARAMETER_FIELDS, PILOT_PBR_PROGRAMS, SOURCE_PBR_PROGRAMS } from './source-pbr-factory.ts';
import { createMaterialTable, packParameterRows, type ParameterField } from './material-table.ts';
import { sourceParameterBinding } from './source-bindings.ts';
import { sourceEnvironmentNodes } from './source-environment.ts';
import { sourceTextureBinding } from './source-textures.ts';
import type { SourceRenderState } from './source-standard.ts';
import type { PbrDescriptor } from '../furniture/pbr-material.ts';
import { installGpuGlobals, recordingCanvas, recordingGpuDevice } from '../../../render-runtime/recording-gpu.test-support.ts';

// Captured pbrLib descriptor schema @2724c79, with all source channels kept separate by this fixture.
const descriptor: PbrDescriptor = {
  family: 'pbr', name: 'brick_tan', set: 'brick_tan', side: 0, envMapIntensity: 1, trim: null,
  paint: false, over: false, street: false, gum: false, city: true, grimeAttr: false, weatherAttr: true, dirtAttr: true,
  pbSize: [2.1336, 1.0832], pbRatio: [1, 1, 1], pbSeed: 0, pbDirt: 0.3, pbBaseY: -10000, pbTopY: 100000,
  pbPaint: [0.3324515, 0.1946178, 0.1070231], pbUnit: [1, 0.125], pbBl: [0.42, 0.58, 1.4], pbRot: [1, 0, 0, 1], pbWorld: 0,
  pbChips: 1, pbRefL: 0.3226, pbScan: [0, 0, 0, 1], pbSubK: 0, pbOver: [0, 0.3226, 0.55], pbCavK: 1,
  pbGrimeC: [0.52, 0.49, 0.45], pbGlazed: 0, pbRS: [0, 1, 0], pbRough: 1, pbMetal: [0, 0], pbNrmK: 1, pbFac: [1, 0, 0],
};
const state: SourceRenderState = { fog: true, side: 0, transparent: false, depthWrite: true, depthTest: true, colorWrite: true,
  blending: THREE.NormalBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  blendSrcAlpha: null, blendDstAlpha: null, blendEquation: THREE.AddEquation, blendEquationAlpha: null,
  premultipliedAlpha: false, alphaHash: false, alphaToCoverage: false, polygonOffset: false, polygonOffsetFactor: 0, polygonOffsetUnits: 0 };

test('PBR factories verify every audited source identity and reject provisional or mutated programs', () => {
  const [shaderHash, program] = Object.entries(PILOT_PBR_PROGRAMS)[0]!;
  assert.equal(classifyPilotPbr({ key: program.key, shaderHash, shaderSha256: program.sha256 }), shaderHash);
  assert.equal(classifyPilotPbr({ key: program.key + 'm', shaderHash, shaderSha256: program.sha256 }), shaderHash);
  assert.throws(() => classifyPilotPbr({ key: program.key, shaderHash, shaderSha256: '0'.repeat(64) }), /Unsupported/);
  assert.throws(() => classifyPilotPbr({ key: program.key, shaderHash, shaderSha256: 'cf109eabce3ab39f79bab4619a48707522b0aba9cf1f3c0a0a8069a3b1a5d222' }), /Unsupported/, 'provisional empty-define identity is not the settled program');
  for (const [hash, source] of Object.entries(SOURCE_PBR_PROGRAMS)) {
    const features = classifySourcePbr({ key: source.key, shaderHash: hash, shaderSha256: source.sha256 });
    assert.equal(features.sharedTint, source.key.includes('|fktr'));
    assert.equal(features.skyMetal, source.key.includes('|skymetalU'));
  }
  const street = SOURCE_PBR_PROGRAMS['76aba290'];
  assert.deepEqual(classifySourcePbr({ key: street.key, shaderHash: '76aba290', shaderSha256: street.sha256 }).trim, [1.94, 1.7, 1.47]);
});

test('all ten PBR compositions bind original XYZ/ORM, exact modifiers and reloadable pages within six vertex buffers', async () => {
  installGpuGlobals();
  const { device, record } = recordingGpuDevice();
  const renderer = new THREE.WebGPURenderer({ canvas: recordingCanvas(32, 32), device } as never);
  await renderer.init();
  const T = THREE.TSL, flatRow = T.varying(T.attribute('aVdSurface', 'vec4').x).setInterpolation('flat');
  const fields: readonly ParameterField[] = [...PBR_PARAMETER_FIELDS, { name: 'emissive', size: 3 },
    ...['emissiveIntensity', 'opacity', 'envMapIntensity', 'fkEnvK'].map((name) => ({ name, size: 1 as const })),
    { name: 'uSmTn', size: 3 }, { name: 'uSmP', size: 4 }];
  const row: Record<string, number | readonly number[]> = {};
  for (const field of PBR_PARAMETER_FIELDS) {
    const value = field.name === 'weatherEnabled' || field.name === 'dirtEnabled' ? 1 : field.name === 'grimeEnabled' ? 0 : descriptor[field.name];
    row[field.name] = typeof value === 'boolean' ? Number(value) : value as number | readonly number[];
  }
  Object.assign(row, { emissive: [0, 0, 0], emissiveIntensity: 1, opacity: 1, envMapIntensity: 1, fkEnvK: 0.3,
    uSmTn: [0.8, 0.9, 1], uSmP: [0.12, 0.55, 0.4, 0.12] });
  const table = createMaterialTable(THREE, packParameterRows('test:pbr-parameters', fields, [row]));
  const variantFields = [{ name: 'fkTr', size: 3 }] as const;
  const variants = createMaterialTable(THREE, packParameterRows('test:pbr-variants', variantFields, [{ fkTr: [0.8, 0.9, 1.1] }]));
  const textures = {
    pbAlb: new THREE.DataArrayTexture(new Uint8Array([90, 120, 150, 255]), 1, 1, 1),
    pbOrm: new THREE.DataArrayTexture(new Uint8Array([200, 70, 160, 30]), 1, 1, 1),
    // Authored Z is intentionally not reconstructed from XY: this pixel's Z differs by almost 0.5.
    pbNrm: new THREE.DataArrayTexture(new Uint8Array([128, 128, 190, 255]), 1, 1, 1),
  };
  for (const texture of Object.values(textures)) { texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.needsUpdate = true; }
  textures.pbAlb.colorSpace = THREE.SRGBColorSpace;
  const samplerBinding = sourceTextureBinding(THREE, Object.fromEntries(Object.entries(textures).map(([name, texture]) => [name, { texture, layer: T.float(0) }])));
  const sampled = new Set<string>(), night = T.uniform(0), env = sourceEnvironmentNodes(THREE, night);
  const common = {
    descriptor, state, material: sourceParameterBinding(table, fields, flatRow), variant: sourceParameterBinding(variants, variantFields, flatRow),
    textures: { uv: (_name: string, uv: THREE.Node<'vec2'>) => uv,
      sample(name: string, uv: THREE.Node<'vec2'>, gradient?: { dx: THREE.Node<'vec2'>; dy: THREE.Node<'vec2'> }) {
        sampled.add(name); const texture = textures[name as keyof typeof textures]; assert.ok(texture);
        assert.ok(gradient, 'source textureGrad derivatives must be preserved');
        return samplerBinding.sample(name, uv, gradient);
      } },
    arrays: { albedo: textures.pbAlb, orm: textures.pbOrm }, diffuseFactor: T.attribute('color', 'vec3'),
    patternPosition: T.positionWorld, patternNormal: T.normalWorldGeometry,
    weather: T.varying(T.attribute('aVdWeather', 'vec4')).setInterpolation('flat'), grime: T.attribute('aVdSurface', 'vec4').z,
    trim: { night: env.night, st34: env.st34, scale: T.vec3(1) }, cs34: env.cs34, cs34Col: env.cs34Col,
    cityAo: { position: T.positionWorld, normal: T.normalWorldGeometry, sample: T.vec2(0.7, 0), rect: T.vec4(0, 0, 1, 1), amount: env.cityAOAmt, lb14Gao: env.lb14Gao, night: env.night },
  };
  const program = PILOT_PBR_PROGRAMS['5d3e43a0'];
  const material = createPilotPbrMaterial(THREE, { ...common, source: { key: program.key, shaderHash: '5d3e43a0', shaderSha256: program.sha256, mapRoles: [] } });
  const geometry = new THREE.BoxGeometry();
  const n = geometry.getAttribute('position').count;
  geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
  geometry.setAttribute('aVdSurface', new THREE.BufferAttribute(new Float32Array(n * 4), 4));
  geometry.setAttribute('aVdWeather', new THREE.BufferAttribute(new Float32Array(n * 4), 4));
  const scene = new THREE.Scene(); scene.add(new THREE.Mesh(geometry, material), new THREE.HemisphereLight(), new THREE.DirectionalLight());
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100); camera.position.z = 4;
  renderer.render(scene, camera);
  assert.deepEqual([...sampled].sort(), ['pbAlb', 'pbNrm', 'pbOrm']);
  assert.ok(record.shaders.some((code) => code.includes('textureSample') && code.includes('textureLoad')));
  assert.ok(record.pipelineVertexBuffers.every((pipeline) => pipeline.buffers <= 6));
  const pipelines = record.renderPipelines;
  const alternate = PILOT_PBR_PROGRAMS.d24a9901;
  const other = createPilotPbrMaterial(THREE, { ...common, descriptor: { ...descriptor, grimeAttr: true }, source: { key: alternate.key, shaderHash: 'd24a9901', shaderSha256: alternate.sha256, mapRoles: [] } });
  scene.add(new THREE.Mesh(geometry, other)); renderer.render(scene, camera);
  assert.equal(record.renderPipelines, pipelines, 'weather/grime variants share the source PBR family pipeline');
  const replacement = new THREE.DataArrayTexture(new Uint8Array([128, 128, 190, 255]), 1, 1, 1);
  replacement.wrapS = replacement.wrapT = THREE.RepeatWrapping; replacement.needsUpdate = true;
  const textureCount = record.textures.length;
  samplerBinding.rebind('pbNrm', replacement); textures.pbNrm.dispose();
  renderer.render(scene, camera);
  assert.equal(record.renderPipelines, pipelines, 'page reload retains shared pipelines');
  assert.equal(record.textures.length, textureCount + 1, 'shared materials use the replacement page without resurrecting the disposed one');
  const extras: THREE.MeshStandardNodeMaterial[] = [];
  for (const [hash, source] of Object.entries(SOURCE_PBR_PROGRAMS)) {
    if (hash in PILOT_PBR_PROGRAMS) continue;
    const features = classifySourcePbr({ key: source.key, shaderHash: hash, shaderSha256: source.sha256 });
    const extra = createSourcePbrMaterial(THREE, { ...common,
      source: { key: source.key, shaderHash: hash, shaderSha256: source.sha256, mapRoles: [] },
      trim: { ...common.trim, scale: T.vec3(...features.trim) },
      frame: { position: T.positionWorld, normal: T.normalWorldGeometry, cameraPosition: T.cameraPosition },
      geometricNormal: T.normalWorldGeometry,
      environment: { night: env.night, reflectionGain: T.float(1), sunDirection: T.vec3(0, 1, 0), sunColor: T.vec3(1), zenith: T.vec3(0.2, 0.3, 0.5), horizon: T.vec3(0.6) },
      variant: features.sharedTint ? common.variant : { ...common.variant, vec3() { throw new Error('Source has no FK tint attribute'); } },
    });
    extras.push(extra); scene.add(new THREE.Mesh(geometry, extra));
  }
  renderer.render(scene, camera);
  assert.equal(extras.length, 8);
  assert.ok(record.pipelineVertexBuffers.every((pipeline) => pipeline.buffers <= 6));
  const allPipelines = record.renderPipelines;
  // All additional shader composition paths share the original texture/table owners across a night transition.
  night.value = 0.92;
  renderer.render(scene, camera);
  assert.equal(record.renderPipelines, allPipelines);
  for (const extra of extras) extra.dispose();
  material.dispose(); other.dispose(); geometry.dispose(); table.dispose(); variants.dispose();
  for (const texture of Object.values(textures)) texture.dispose();
  replacement.dispose();
  renderer.dispose();
});
