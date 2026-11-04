import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { createSourceCustomBuildingMaterial } from './source-custom-building-factory.ts';
import { SOURCE_CUSTOM_BUILDING_IDENTITIES, classifyCustomBuildingSource, customBuildingParameterSchema, customBuildingSourceConstants, type SourceCustomBuildingIdentity } from './source-custom-building-programs.ts';
import { sourceParameterBinding } from './source-bindings.ts';
import { createMaterialTable } from './material-table.ts';
import type { SourceRenderState } from './source-standard.ts';
import { installGpuGlobals, recordingCanvas, recordingGpuDevice } from '../../../render-runtime/recording-gpu.test-support.ts';

const state: SourceRenderState = { fog: true, side: THREE.FrontSide, transparent: false, depthWrite: true, depthTest: true,
  colorWrite: true, blending: THREE.NormalBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  blendSrcAlpha: null, blendDstAlpha: null, blendEquation: THREE.AddEquation, blendEquationAlpha: null,
  premultipliedAlpha: false, alphaHash: false, alphaToCoverage: false, polygonOffset: false, polygonOffsetFactor: 0, polygonOffsetUnits: 0 };
const identities = SOURCE_CUSTOM_BUILDING_IDENTITIES.map(value => ({ key: value.key, shaderHash: value.hash, shaderSha256: value.sha256,
  type: value.type, vertexColors: value.vertexColorModes[0], hasAlphaTest: value.alphaTestModes[0], mapRoles: value.mapRoleSets[0], normalMapType: 0 } satisfies SourceCustomBuildingIdentity));

test('settled non-PBR-wrapped custom families bind maps, normals, tower glass and self lighting to shared tables', async () => {
  installGpuGlobals(); const { device, record } = recordingGpuDevice();
  const renderer = new THREE.WebGPURenderer({ canvas: recordingCanvas(32, 32), device } as never); await renderer.init();
  const T = THREE.TSL, night = T.uniform(0), scene = new THREE.Scene(), geometry = new THREE.BoxGeometry();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100); camera.position.z = 4; scene.add(new THREE.DirectionalLight());
  const texture = new THREE.DataTexture(new Uint8Array([128, 128, 230, 255]), 1, 1); texture.needsUpdate = true;
  const materials: THREE.MeshStandardNodeMaterial[] = [], tables: ReturnType<typeof createMaterialTable>[] = [];
  for (const source of identities) {
    const fields = customBuildingParameterSchema(source).material, values = new Float32Array(fields.length * 4);
    const constants = customBuildingSourceConstants(source);
    fields.forEach((field, column) => {
      const special: Record<string, readonly number[]> = {
        diffuse: [0.6, 0.4, 0.3], emissive: [0.2, 0.1, 0.05], normalScale: [1.5, 1.5],
        pgBody: [0.3, 0.4, 0.3], pgOrg: [0, 0, 0], pgRm: [3.7, 0, 7, 1.45],
        sourceDayNight: constants.sourceDayNight ?? [0, 0], pgF0: [0.08], pgRough: [0.03], pgDirt: [0.1], pgStW: [30.5],
        pgGlow: [0], pgSd: [0], pgSlk: [0], alphaTest: [0],
      };
      values.set(special[field.name] ?? Array(field.size).fill(1), column * 4);
    });
    const table = createMaterialTable(THREE, { name: source.key, columns: fields.length, rows: 1, values }); tables.push(table);
    const material = createSourceCustomBuildingMaterial(THREE, { name: source.key, source, state,
      material: sourceParameterBinding(table, fields, T.float(0)), rawUv: T.uv(), rawColor: T.vec3(0.7), sourceWorld: T.positionWorld, night,
      textures: { uv: (_role, uv) => uv.mul(T.vec2(0.625)), sample: (_role, uv) => T.texture(texture, uv) },
      common: { trim: { night, scale: T.vec3(1), st34: T.vec4(1, 0, 0, 0) },
        cityAo: { position: T.positionWorld, normal: T.normalWorldGeometry, sample: T.vec2(0.8, 0), rect: T.vec4(0, 0, 1, 1), amount: T.float(0.85), lb14Gao: T.float(0), night },
        cityReflection: { height: T.positionWorld.y, cs34: T.vec4(0), cs34Col: T.vec4(1), pbrCity: false } },
      glass: { frame: { position: T.positionWorld, normal: T.normalWorldGeometry, cameraPosition: T.cameraPosition },
        geometricNormal: T.normalWorldGeometry, groundHeight: T.float(0),
        environment: { night, reflectionGain: T.float(1), sunDirection: T.vec3(0, 1, 0), sunColor: T.vec3(1), zenith: T.vec3(0.2, 0.4, 0.7), horizon: T.vec3(0.7) } },
    });
    materials.push(material); scene.add(new THREE.Mesh(geometry, material));
  }
  assert.equal(materials.length, identities.length);
  renderer.render(scene, camera); const pipelines = record.renderPipelines;
  assert.ok(record.shaders.some(code => code.includes('43758.5453')));
  night.value = 1; renderer.render(scene, camera); assert.equal(record.renderPipelines, pipelines);
  for (const material of materials) material.dispose(); for (const table of tables) table.dispose();
  texture.dispose(); geometry.dispose(); renderer.dispose();
});

test('the captured monument is the mapped Standard LT/CR/MR chain, not a scanned PBR descriptor', () => {
 const source=identities.find(value=>classifyCustomBuildingSource(value)==='monument-reflection')!;
 assert.ok(source.key.endsWith('|lighttrim1,1,1|st34|pbcity|b3mr'));
 const fields=customBuildingParameterSchema(source).material.map(field=>field.name);
 assert.ok(fields.includes('roughness'));assert.ok(!fields.includes('pbRatio'));
});
