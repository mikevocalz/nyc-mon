import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { createSourceApolloMaterial } from './source-apollo-factory.ts';
import { SOURCE_APOLLO_IDENTITIES, apolloParameterSchema, type SourceApolloIdentity } from './source-apollo-programs.ts';
import { sourceParameterBinding } from './source-bindings.ts';
import { createMaterialTable } from './material-table.ts';
import type { SourceRenderState } from './source-standard.ts';
import { installGpuGlobals, recordingCanvas, recordingGpuDevice } from '../../../render-runtime/recording-gpu.test-support.ts';

const state: SourceRenderState = { fog: true, side: THREE.FrontSide, transparent: false, depthWrite: true, depthTest: true,
  colorWrite: true, blending: THREE.NormalBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  blendSrcAlpha: null, blendDstAlpha: null, blendEquation: THREE.AddEquation, blendEquationAlpha: null,
  premultipliedAlpha: false, alphaHash: false, alphaToCoverage: false, polygonOffset: false, polygonOffsetFactor: 0, polygonOffsetUnits: 0 };
const source = (program: keyof typeof SOURCE_APOLLO_IDENTITIES): SourceApolloIdentity => {
  const value = SOURCE_APOLLO_IDENTITIES[program];
  return { key: value.key, type: value.type, shaderHash: value.hash, shaderSha256: value.sha256,
    vertexColors: false, hasAlphaTest: program === 'a32sign', mapRoles: value.mapRoleSets[0] };
};

test('all eight settled Apollo programs bind exact table/map paths and reuse pipelines across night changes', async () => {
  installGpuGlobals();
  const { device, record } = recordingGpuDevice();
  const renderer = new THREE.WebGPURenderer({ canvas: recordingCanvas(32, 32), device } as never); await renderer.init();
  const T = THREE.TSL, night = T.uniform(0), geometry = new THREE.BoxGeometry();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100); camera.position.z = 4;
  const scene = new THREE.Scene(); scene.fog = new THREE.Fog(0xaaaaaa, 2, 20); scene.add(new THREE.DirectionalLight());
  const image = new THREE.DataTexture(new Uint8Array([128, 80, 30, 64, 255, 0, 0, 255, 0, 0, 0, 0, 50, 100, 160, 255]), 2, 2);
  image.colorSpace = THREE.SRGBColorSpace; image.needsUpdate = true;
  const tables: ReturnType<typeof createMaterialTable>[] = [], materials: THREE.NodeMaterial[] = [];
  let samples = 0;
  for (const program of Object.keys(SOURCE_APOLLO_IDENTITIES) as (keyof typeof SOURCE_APOLLO_IDENTITIES)[]) {
    const identity = source(program), fields = apolloParameterSchema(identity).material;
    const values = new Float32Array(fields.length * 4);
    fields.forEach((field, column) => {
      values.set(field.name === 'diffuse' ? [0.6, 0.4, 0.2] : field.name === 'emissive' ? [1, 0.5, 0.2] : [field.name === 'alphaTest' ? 0.5 : 1], column * 4);
    });
    const table = createMaterialTable(THREE, { name: program, columns: fields.length, rows: 1, values }); tables.push(table);
    const material = createSourceApolloMaterial(THREE, { name: program, source: identity, state,
      material: sourceParameterBinding(table, fields, T.float(0)), rawUv: T.uv(), night,
      trim: { night, scale: T.vec3(1), st34: T.vec4(1, 0, 0, 0) },
      textures: { uv: (_role, uv) => uv.mul(T.vec2(2, 1)), sample: () => { samples++; return T.texture(image, T.uv()); } },
    });
    assert.equal('isMeshBasicNodeMaterial' in material && material.isMeshBasicNodeMaterial === true, identity.type === 'MeshBasicMaterial');
    if (identity.hasAlphaTest) assert.ok(material.alphaTestNode, 'marquee coverage uses its authored discard');
    materials.push(material); scene.add(new THREE.Mesh(geometry, material));
  }
  assert.equal(samples, 6, 'two mapped signs plus two weather-film faces retain their source maps');
  renderer.render(scene, camera); const pipelines = record.renderPipelines;
  assert.ok(record.shaders.some(text => text.includes('textureSample')));
  night.value = 1; renderer.render(scene, camera); assert.equal(record.renderPipelines, pipelines);
  for (const material of materials) material.dispose(); for (const table of tables) table.dispose();
  geometry.dispose(); image.dispose(); renderer.dispose();
});

test('unknown identities and missing authored texture pages fail before material publication', () => {
  const T = THREE.TSL;
  const material = { scalar: () => T.float(1), vec2: () => T.vec2(1), vec3: () => T.vec3(1), vec4: () => T.vec4(1) };
  const input = { name: 'Apollo', source: source('a32sign'), state, material, rawUv: T.uv(), night: T.float(0),
    trim: { night: T.float(0), scale: T.vec3(1), st34: T.vec4(1, 0, 0, 0) },
    textures: { uv: () => { throw new Error('Missing authored page'); }, sample: () => T.vec4(1) } };
  assert.throws(() => createSourceApolloMaterial(THREE, input), /Missing authored page/);
  assert.throws(() => createSourceApolloMaterial(THREE, { ...input, source: { ...input.source, shaderSha256: '0'.repeat(64) } }), /Unsupported/);
});
