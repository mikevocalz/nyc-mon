import * as THREE from 'three/webgpu';
import { exp, float, mix, modelViewMatrix, positionGeometry, uniform, varying, vec2, vec3, vec4 } from 'three/tsl';
import * as t3 from '@typegpu/three';
import { d } from 'typegpu';
import { parseColor, type NeonColorInput } from '../../neon/colors';
import { approach } from '../pointer';
import type { ThreeContext, ThreeFrame, ThreeScene } from '../types';
import { cursorWeight, terrainHeight } from './height';
import {
  ACCENT_MIX, CAMERA_FOV, cameraPosition, CURSOR_FADE, CURSOR_FOLLOW, FOG_DENSITY, terrainOpacity, terrainSegments, type TerrainOptions,
} from './terrain-config';

/** toTSL's result, typed as the vec2 the TypeGPU function returns. */
type Vec2Node = ReturnType<typeof vec2>;

/**
 * Store a colour's sRGB values as they are. The renderer outputs without a
 * colour-space conversion (see below), so these are the values on screen.
 */
function setRaw(target: THREE.Color, input: NeonColorInput) {
  const [r, g, b] = parseColor(input);
  target.setRGB(r, g, b, THREE.LinearSRGBColorSpace);
}

/**
 * NeonBlade's Holographic Terrain as a three.js scene on WebGPURenderer: a
 * subdivided plane laid flat, drawn as a wireframe, its vertices lifted on the
 * GPU by four overlapping sines and a gaussian bump under the cursor, faded
 * into the background by FogExp2 and seen from a raised camera looking at the
 * origin. The cursor is raycast onto the y = 0 plane once a frame, as in the
 * original.
 *
 * NeonBlade's ShaderMaterial writes its colours straight to the canvas, and
 * WebGL blends and resolves its antialiased lines there, in display space.
 * WebGPURenderer would otherwise draw into a linear buffer and convert at the
 * end, which resolves 1px lines brighter and heavier. So the renderer outputs
 * without conversion, colours go in as their sRGB values, and fog is mixed in
 * the shader the way NeonBlade's fog chunk mixes it.
 *
 * The height is a TypeGPU function bridged with @typegpu/three; the rest is
 * TSL, so the one material compiles to WGSL on WebGPU and GLSL on WebGL2.
 */
export function createTerrainScene({ renderer }: ThreeContext, initial: TerrainOptions): ThreeScene<TerrainOptions> {
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 1000);
  const clear = new THREE.Color();

  const waveU = uniform(new THREE.Vector4(), 'vec4'); // amplitude, frequency, time, unused
  const cursorU = uniform(new THREE.Vector4(), 'vec4'); // world x, world z, on 0..1, unused
  const bumpU = uniform(new THREE.Vector2(), 'vec2'); // radius, strength
  const lineU = uniform(new THREE.Color());
  const accentU = uniform(new THREE.Color());
  const fogColorU = uniform(new THREE.Color());
  const fogDensityU = uniform(FOG_DENSITY); // 0 with fog off
  const opacityU = uniform(1);

  const position = t3.fromTSL(positionGeometry, d.vec3f);
  const wave = t3.fromTSL(waveU, d.vec4f);
  const cursor = t3.fromTSL(cursorU, d.vec4f);
  const bump = t3.fromTSL(bumpU, d.vec2f);

  // Vertex stage, in TypeGPU: (height, cursor weight) at this vertex's x, z.
  const lifted = t3.toTSL(() => {
    'use gpu';
    const p = position.$;
    const xz = d.vec2f(p.x, p.z);
    return d.vec2f(terrainHeight(xz, wave.$, cursor.$, bump.$), cursorWeight(xz, cursor.$, bump.$.x));
  }) as unknown as Vec2Node;

  const displaced = vec3(positionGeometry.x, lifted.x, positionGeometry.z);
  const material = new THREE.MeshBasicNodeMaterial({ wireframe: true, transparent: true, fog: false });
  material.positionNode = displaced;

  // Fragment stage: the line colour, tinted toward the accent by the bump,
  // then FogExp2 by view depth, as three's fog chunk computes it.
  const depth = varying(modelViewMatrix.mul(vec4(displaced, 1)).z.negate(), 'vFogDepth');
  const weight = varying(lifted.y, 'vCursor');
  const fogAmount = float(1).sub(exp(fogDensityU.mul(fogDensityU).mul(depth).mul(depth).negate()));
  const line = mix(lineU, accentU, weight.mul(ACCENT_MIX));
  material.colorNode = mix(line, fogColorU, fogAmount);
  material.opacityNode = opacityU;

  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
  // The vertex shader moves every vertex; CPU bounds would be wrong.
  mesh.frustumCulled = false;
  scene.add(mesh);

  const raycaster = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();
  const ndc = new THREE.Vector2();
  const cursorValue = cursorU.value as THREE.Vector4;
  const waveValue = waveU.value as THREE.Vector4;
  // Where the bump is heading and how far it is switched on (0..1). The
  // shown cursor eases toward these, so the bump glides instead of jumping
  // with each pointer event.
  const target = { x: 0, z: 0, on: 0 };
  let aspect = 1;
  let viewKey = '';
  let shape = '';
  let styled: TerrainOptions | null = null;

  const rebuild = (o: TerrainOptions) => {
    const segs = terrainSegments(o.gridSegments);
    const key = `${o.planeWidth}:${o.planeDepth}:${segs}`;
    if (key === shape) return;
    shape = key;
    const geometry = new THREE.PlaneGeometry(o.planeWidth, o.planeDepth, segs, segs);
    // Laid flat, so the shader reads position.x and position.z as world x, z.
    geometry.rotateX(-Math.PI / 2);
    mesh.geometry.dispose();
    mesh.geometry = geometry;
  };

  const placeCamera = (o: TerrainOptions) => {
    const key = `${aspect}:${o.cameraHeight}`;
    if (key === viewKey) return;
    viewKey = key;
    const [x, y, z] = cameraPosition(o.cameraHeight);
    camera.aspect = aspect;
    camera.position.set(x, y, z);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  };

  // Colours and the other per-prop uniforms, only when the params change
  // (HolographicTerrain hands a new params object only on a prop change).
  const style = (o: TerrainOptions) => {
    if (o === styled) return;
    styled = o;
    setRaw(clear, o.bgColor);
    renderer.setClearColor(clear, 1);
    setRaw(lineU.value as THREE.Color, o.lineColor);
    setRaw(accentU.value as THREE.Color, o.accentColor);
    (fogColorU.value as THREE.Color).copy(clear);
    fogDensityU.value = o.fog ? FOG_DENSITY : 0;
    opacityU.value = terrainOpacity(o.opacity);
    (bumpU.value as THREE.Vector2).set(o.bumpRadius, o.bumpStrength);
  };

  const update = (frame: ThreeFrame, o: TerrainOptions) => {
    rebuild(o);
    placeCamera(o);
    style(o);

    // As in NeonBlade: off the canvas the bump goes away; on it, a ray that
    // misses the plane (above the horizon) keeps the last hit.
    if (!frame.pointer.inside) {
      target.on = 0;
    } else {
      ndc.set(frame.pointer.x, frame.pointer.y);
      raycaster.setFromCamera(ndc, camera);
      if (raycaster.ray.intersectPlane(plane, hit)) {
        target.x = hit.x;
        target.z = hit.z;
        target.on = 1;
      }
    }
    // Ease by elapsed time, so the response is the same at 30, 60 or 120 fps.
    // A one-off redraw (delta 0: paused, reduced motion) snaps. A bump that
    // is fully off jumps to the new spot rather than sliding across.
    const dt = frame.delta;
    const snap = dt <= 0 || cursorValue.z < 0.01;
    cursorValue.x = snap ? target.x : approach(cursorValue.x, target.x, dt, CURSOR_FOLLOW);
    cursorValue.y = snap ? target.z : approach(cursorValue.y, target.z, dt, CURSOR_FOLLOW);
    cursorValue.z = dt <= 0 ? target.on : approach(cursorValue.z, target.on, dt, CURSOR_FADE);
    waveValue.z = frame.time * o.waveSpeed;
    waveValue.x = o.waveAmplitude;
    waveValue.y = o.waveFrequency;
  };

  rebuild(initial);

  return {
    scene,
    camera,
    update,
    resize: (width, height) => {
      aspect = width / Math.max(1, height);
    },
    dispose: () => {
      mesh.geometry.dispose();
      material.dispose();
    },
  };
}
