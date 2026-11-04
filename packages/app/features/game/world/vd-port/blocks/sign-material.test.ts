import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import {
  evaluateSignFace, evaluateSignFalloff, evaluateSignSaturation, signFaceNodes, signGlowNodes,
  signDustNodes, signShadeOutput, signHaloOutput, signEaseOutput, sourceSignProgram, SIGN_SOURCE_PROGRAMS, SIGN_OUTPUT_STAGE,
} from './sign-material.ts';
import { installSourceOutputHook } from './source-output.ts';
import { installGpuGlobals, recordingCanvas, recordingGpuDevice } from '../../../render-runtime/recording-gpu.test-support.ts';

// Copied verbatim scalar source GLSL at the declared 2724c79 signKit.js pin.
// Execute the original expressions as an independent numeric reference, not the port's helpers.
const FALLV = `float sgFallKv( vec2 uv, vec3 f ) {
    if ( f.x <= 0.0 ) return 1.0;
    float ex = min( uv.x, 1.0 - uv.x ) * f.y, ey = min( uv.y, 1.0 - uv.y );
    float e = smoothstep( 0.0, 0.3, min( ex, ey ) );
    float rows = 0.5 + 0.5 * cos( ( uv.y * f.z - 0.5 ) * 6.2832 );
    return mix( 1.0, ( 0.58 + 0.42 * e ) * ( 0.86 + 0.14 * rows ) * 1.12, f.x );
  }`;
const SAT = `float sgSatF( vec3 c ) { float sm = c.r + c.g + c.b; return 1.0 - sgSatK * smoothstep( 0.5, 0.9, sm > 1e-4 ? c.r / sm : 0.0 ); }`;
const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const mix = (a: number, b: number, t: number) => a * (1 - t) + b * t;
const sourceFall = new Function('min', 'smoothstep', 'cos', 'mix', `return (${FALLV.replace('float sgFallKv( vec2 uv, vec3 f )', 'function(uv,f)').replace(/\bfloat\b/g, 'let')})`)(Math.min, smooth, Math.cos, mix) as (uv: { x: number; y: number }, f: { x: number; y: number; z: number }) => number;
const sourceSat = new Function('sgSatK', 'smoothstep', `return (${SAT.replace('float sgSatF( vec3 c )', 'function(c)').replace(/\bfloat\b/g, 'let')})`)(0.75, smooth) as (c: { r: number; g: number; b: number }) => number;
const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);

test('source lamp falloff and saturation match pinned GLSL over cabinet edges, rows, ink colors and black', () => {
  for (const uv of [[0, 0], [0.5, 0.5], [0.1, 0.9], [1, 1], [-0.2, 1.1]] as const) for (const f of [[0, 1, 1], [0.7, 2, 3], [1, 0.5, 4]] as const) {
    near(evaluateSignFalloff(uv, f), sourceFall({ x: uv[0], y: uv[1] }, { x: f[0], y: f[1], z: f[2] }));
  }
  for (const c of [[0, 0, 0], [1, 0, 0], [0.8, 0.1, 0.05], [1, 1, 1], [0, 0, 3]] as const) near(evaluateSignSaturation(c, 0.75), sourceSat({ r: c[0], g: c[1], b: c[2] }));
});

test('sampled mask and RGBA faces preserve coverage alpha, grime, source emission and authored surface factors', () => {
  const input = {
    color: [0.5, 0.6, 0.7] as const, opacity: 0.8, sample: [0.25, 0, 0, 0] as const, uv: [0.5, 0.15] as const,
    bg: [0.1, 0.2, 0.3] as const, fg: [0.8, 0.1, 0.05] as const, lamp: [2, 1, 0.5] as const,
    p: [0, 0.2, 0, 0.32] as const, f: [0, 1, 1, 0.1] as const, night: 1, saturation: 0.75,
  };
  const mask = evaluateSignFace(input, true, true);
  const sat = sourceSat({ r: 0.8, g: 0.1, b: 0.05 });
  [0.1265, 0.0966, 0.15295].forEach((value, i) => near(mask.color[i]!, value));
  near(mask.opacity, 0.2);
  [0.4, 0.025, 0.00625].forEach((value, i) => near(mask.emission[i]!, value * sat));
  near(mask.roughness, 0.32); near(mask.metalness, 0.1);
  const full = evaluateSignFace({ ...input, sample: [0.2, 0.4, 0.6, 0.3], night: 0.335 }, false, true);
  [0.1, 0.24, 0.42].forEach((value, i) => near(full.color[i]!, value));
  near(full.opacity, 0.24);
  [0.06, 0.06, 0.045].forEach((value, i) => near(full.emission[i]!, value));
  near(evaluateSignFace(input, true, false).opacity, 0.8);
  const black = evaluateSignFace({ ...input, bg: [0, 0, 0], fg: [0, 0, 0] }, true, true);
  assert.ok(black.emission.every(Number.isFinite));
});

test('only recorded source SG program hashes are classified', () => {
  for (const [suffix, hash] of Object.entries(SIGN_SOURCE_PROGRAMS)) assert.equal(sourceSignProgram(`prefix|${suffix}`, hash), suffix);
  assert.throws(() => sourceSignProgram('prefix|ar33sg3Ml', 'wrong'), /Unsupported/);
  assert.throws(() => sourceSignProgram('prefix|ar33sgUnknown', 'fe98b3e3'), /Unsupported/);
  assert.equal(SIGN_OUTPUT_STAGE.domain, 'linear-hdr');
  assert.equal(SIGN_OUTPUT_STAGE.stage, 'before-fog');
});

test('every observed SG role compiles actual texture sampling, transparency and pre-fog output hooks to native WGSL', async () => {
  installGpuGlobals();
  const { device, record } = recordingGpuDevice();
  const renderer = new THREE.WebGPURenderer({ canvas: recordingCanvas(32, 32), device } as never);
  await renderer.init();
  const T = THREE.TSL, night = T.uniform(0.335);
  const rgba = new THREE.DataTexture(new Uint8Array([128, 64, 32, 80, 255, 0, 0, 255, 0, 0, 0, 0, 30, 80, 120, 255]), 2, 2);
  rgba.colorSpace = THREE.SRGBColorSpace; rgba.minFilter = THREE.LinearMipmapLinearFilter; rgba.magFilter = THREE.LinearFilter; rgba.generateMipmaps = true; rgba.needsUpdate = true;
  const mask = new THREE.DataTexture(new Uint8Array([0, 64, 128, 255]), 2, 2, THREE.RedFormat);
  mask.colorSpace = THREE.NoColorSpace; mask.minFilter = THREE.LinearMipmapLinearFilter; mask.magFilter = THREE.LinearFilter; mask.generateMipmaps = true; mask.needsUpdate = true;
  const shadow = new THREE.DataTexture(new Uint8Array([128, 64, 0, 255]), 1, 1);
  shadow.colorSpace = THREE.NoColorSpace; shadow.needsUpdate = true;
  const geometry = new THREE.BoxGeometry();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100); camera.position.z = 4;
  const scene = new THREE.Scene(); scene.fog = new THREE.Fog(0xaaaaaa, 2, 20);
  const materialList: THREE.NodeMaterial[] = [];
  for (const [masked, decal] of [[true, true], [true, false], [false, true], [false, false]] as const) {
    const material = new THREE.MeshStandardNodeMaterial();
    const face = signFaceNodes(THREE, {
      color: T.vec3(0.6), opacity: T.float(0.8), night, saturation: T.float(0.75), uv: T.uv(), mapUv: T.uv().mul(T.vec2(1, 2)),
      variant: { rect: T.vec4(0.1, 0.2, 0.5, 0.6), bg: T.vec3(0.1, 0.2, 0.3), fg: T.vec3(0.8, 0.1, 0.05), lamp: T.vec3(2, 1, 0.5), p: T.vec4(0, 0.2, 0.1, 0.32), f: T.vec4(0.7, 2, 3, 0.1) },
      sampleAtlas: (uv) => T.texture(masked ? mask : rgba, uv),
    }, masked, decal);
    material.colorNode = face.color; material.opacityNode = face.opacity; material.emissiveNode = face.emission;
    material.roughnessNode = face.roughness; material.metalnessNode = face.metalness;
    material.transparent = decal; material.depthWrite = !decal; material.alphaTest = decal ? 0.02 : 0;
    installSourceOutputHook(material, (out) => signEaseOutput(THREE, out, night));
    materialList.push(material);
  }
  const glow = new THREE.MeshStandardNodeMaterial();
  const glowNodes = signGlowNodes(THREE, T.vec3(0.3), T.vec3(2, 0.1, 0), night, T.float(0.1), T.float(0.2));
  glow.colorNode = glowNodes.color; glow.emissiveNode = glowNodes.emission;
  installSourceOutputHook(glow, (out) => signEaseOutput(THREE, out, night)); materialList.push(glow);
  const dust = new THREE.MeshStandardNodeMaterial();
  const dustNodes = signDustNodes(THREE, T.vec3(0.6), T.float(0.38), T.normalWorld.y);
  dust.colorNode = dustNodes.color; dust.roughnessNode = dustNodes.roughness; materialList.push(dust);
  const shade = new THREE.MeshBasicNodeMaterial(); shade.transparent = true; shade.depthWrite = false; shade.fog = false;
  shade.blending = THREE.CustomBlending; shade.blendSrc = THREE.OneFactor; shade.blendDst = THREE.OneMinusSrcAlphaFactor; shade.blendSrcAlpha = THREE.ZeroFactor; shade.blendDstAlpha = THREE.OneFactor;
  installSourceOutputHook(shade, () => signShadeOutput(THREE, T.texture(shadow, T.uv()), T.vec3(2, 1, 0.5), T.float(0.4), night)); materialList.push(shade);
  const halo = new THREE.MeshBasicNodeMaterial(); halo.transparent = true; halo.depthWrite = false; halo.blending = THREE.AdditiveBlending;
  halo.colorNode = T.texture(rgba, T.uv()).rgb;
  installSourceOutputHook(halo, (out) => signHaloOutput(THREE, out, T.float(1.4), night)); materialList.push(halo);
  for (const material of materialList) {
    const mesh = new THREE.Mesh(geometry, material); scene.add(mesh); renderer.render(scene, camera); scene.remove(mesh);
  }
  assert.ok(record.shaders.some((source) => source.includes('textureSample') && source.includes('6.2832')));
  assert.ok(record.shaders.some((source) => source.includes('0.86') && source.includes('0.42')));
  const pipelines = record.renderPipelines; night.value = 1;
  scene.add(new THREE.Mesh(geometry, materialList[0])); renderer.render(scene, camera);
  assert.equal(record.renderPipelines, pipelines, 'night changes reuse the same authored family pipeline');
  for (const material of materialList) material.dispose();
  geometry.dispose(); rgba.dispose(); mask.dispose(); shadow.dispose(); renderer.dispose();
});
