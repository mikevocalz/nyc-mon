import * as THREE from 'three/webgpu';
import {
  abs, float, floor, fract, fwidth, max, min, mix, normalGeometry, positionGeometry, positionWorld, select, sin, smoothstep,
  step, uniform, uv, varying, vec3, vec4, attribute,
} from 'three/tsl';
import * as t3 from '@typegpu/three';
import { d } from 'typegpu';
import { parseColor, type NeonColorInput } from '../../neon/colors';
import { approach } from '../pointer';
import type { ThreeContext, ThreeFrame, ThreeScene } from '../types';
import { FLOORS_PER_BLOCK, scrolledRow, terrainHeight } from './height';
import { buildBlockArrays } from './terrain-geometry';
import {
  bumpInBlocks, cameraFov, FOOTPRINT, HEIGHT_SCALE, PROFILES, terrainGrid, terrainPalette, WINDOW_DENSITY, type TerrainGrid,
  type TerrainOptions,
} from './terrain-config';

type FloatNode = THREE.Node<'float'>;
/** toTSL's result, typed as the vec4 the TypeGPU function returns. */
type Vec4Node = ReturnType<typeof vec4>;

/** Brand colour input (preset, token or CSS) into a three Color, read as sRGB. */
function setColor(target: THREE.Color, input: NeonColorInput) {
  const [r, g, b] = parseColor(input);
  target.setRGB(r, g, b, THREE.SRGBColorSpace);
}

// Same hash as the TypeGPU blockHash, for the fragment stage.
const hash2 = (a: FloatNode, b: FloatNode): FloatNode => fract(sin(a.mul(127.1).add(b.mul(311.7))).mul(43758.5453));

/**
 * The 3D terrain: a grid of solid city blocks on a street plane, under
 * FogExp2 in the night colour, seen from NeonBlade's raised camera.
 *
 * Heights come from `terrainHeight`, a TypeGPU function bridged into the
 * vertex shader with @typegpu/three; everything else is TSL, so the one
 * material compiles to WGSL on WebGPU and GLSL on the WebGL2 backend. Blocks
 * scroll toward the camera and wrap, rising out of the street at the far
 * edge. The pointer is raycast onto the ground plane, as in NeonBlade, and
 * lifts or ripples the blocks under it.
 */
export function createTerrainScene({ renderer }: ThreeContext, initial: TerrainOptions): ThreeScene<TerrainOptions> {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 300);
  const fog = new THREE.FogExp2(0x00041c, initial.fogDensity);
  const clear = new THREE.Color();

  // Uniforms: plain TSL nodes, each also exposed to TypeGPU through fromTSL.
  const gridU = uniform(new THREE.Vector4(), 'vec4'); // cols, rows, cell, height scale
  const waveU = uniform(new THREE.Vector4(), 'vec4'); // amplitude, frequency, wave time, scroll
  const profileU = uniform(new THREE.Vector4(), 'vec4');
  const cursorU = uniform(new THREE.Vector4(), 'vec4'); // x, z, active, mode
  const bumpU = uniform(new THREE.Vector4(), 'vec4'); // radius, strength, clock
  const styleU = uniform(new THREE.Vector4(), 'vec4'); // lines 0/1, window density, clock, unused
  const bodyU = [0, 1, 2, 3].map(() => uniform(new THREE.Color()));
  const accentU = uniform(new THREE.Color());
  const lightU = uniform(new THREE.Color());
  const groundU = uniform(new THREE.Color());
  const avenueU = uniform(new THREE.Color());

  const cellAttr = t3.fromTSL(attribute('aCell', 'vec2'), d.vec2f);
  const grid = t3.fromTSL(gridU, d.vec4f);
  const wave = t3.fromTSL(waveU, d.vec4f);
  const profile = t3.fromTSL(profileU, d.vec4f);
  const cursor = t3.fromTSL(cursorU, d.vec4f);
  const bump = t3.fromTSL(bumpU, d.vec4f);

  // Vertex stage, in TypeGPU: (height in blocks, local z, terrain z, centred x).
  const placed = t3.toTSL(() => {
    'use gpu';
    const c = cellAttr.$;
    const g = grid.$;
    const w = wave.$;
    const row = scrolledRow(c.y, w.w, g.y);
    const x = c.x - g.x * 0.5 + 0.5;
    const h = terrainHeight(d.vec2f(x, row.y), w, profile.$, cursor.$, bump.$);
    return d.vec4f(h, row.x, row.y, x);
  }) as unknown as Vec4Node;

  const height = placed.x;
  const zLocal = placed.y;
  const rows = gridU.y;
  const cellSize = gridU.z;
  // Blocks rise out of the street as they enter at the far edge, floor by floor.
  const rise = smoothstep(0, 4, zLocal);
  const shown = max(floor(height.mul(rise).mul(FLOORS_PER_BLOCK)).div(FLOORS_PER_BLOCK), 0.02);
  const material = new THREE.MeshBasicNodeMaterial({ fog: true });
  material.positionNode = vec3(
    placed.w.add(positionGeometry.x.mul(FOOTPRINT)).mul(cellSize),
    positionGeometry.y.mul(shown).mul(cellSize).mul(gridU.w),
    zLocal.sub(rows.mul(0.5)).add(0.5).add(positionGeometry.z.mul(FOOTPRINT)).mul(cellSize),
  );

  // Fragment stage.
  const block = varying(vec4(shown, placed.z, placed.w, 0), 'vBlock');
  const blockH = block.x;
  const blockZ = block.y;
  const blockX = block.z;
  const n = normalGeometry;
  const roof = step(0.5, n.y);
  const face = uv();
  const pick = hash2(blockX.add(0.31), blockZ.add(0.77)).mul(4);
  const body = select(pick.lessThan(1), bodyU[0]!, select(pick.lessThan(2), bodyU[1]!, select(pick.lessThan(3), bodyU[2]!, bodyU[3]!)));
  // Flat light from above and front left, as solid shade steps: roofs full,
  // fronts a step down, the two sides further apart. The factors apply in
  // linear space, so they are lower than the sRGB steps they read as.
  const shade = select(n.z.greaterThan(0.5), float(0.5), select(n.x.greaterThan(0.5), float(0.32), float(0.2)));
  const isLines = styleU.x;
  // Accent crowns only on the tallest blocks, and not all of them, so orange stays an accent.
  const tall = step(3.75, blockH).mul(step(0.35, hash2(blockX.add(4.1), blockZ.sub(2.3))));

  // Windows: three bays across each wall, one row per floor.
  const floors = max(blockH.mul(FLOORS_PER_BLOCK), 1);
  const gu = face.x.mul(3);
  const gv = face.y.mul(floors);
  const wu = fract(gu);
  const wv = fract(gv);
  const inWindow = step(0.2, wu).mul(step(wu, 0.8)).mul(step(0.3, wv)).mul(step(wv, 0.78)).mul(float(1).sub(roof));
  const windowId = hash2(floor(gu).add(n.x.mul(5)).add(blockX.mul(13.1)), floor(gv).add(blockZ.mul(3.7)));
  // A few lit windows switch off and on, slowly. Frozen under reduced motion.
  const flicker = hash2(windowId.mul(91), floor(styleU.z.mul(0.2).add(windowId.mul(9))));
  const lit = step(float(1).sub(styleU.y), windowId).mul(step(0.08, flicker));
  const glass = mix(body.mul(0.42), lightU, lit);

  // A cornice: the top floor's upper band in the roof tone, so each block's
  // silhouette reads as a stepped solid against the one behind it.
  const cornice = step(floors.sub(0.18), gv).mul(float(1).sub(roof));
  const wall = mix(mix(body.mul(shade), glass, inWindow), mix(body, vec3(1, 1, 1), 0.12).mul(0.8), cornice);
  const roofColor = mix(mix(body, vec3(1, 1, 1), 0.12), accentU, tall);
  const solid = mix(wall, roofColor, roof);

  // Lines: dark solid faces with lit edges and floor lines, NeonBlade's line look kept solid underneath.
  const edgeU = min(face.x, float(1).sub(face.x)).div(fwidth(face.x).add(1e-4));
  const edgeV = min(face.y, float(1).sub(face.y)).div(fwidth(face.y).add(1e-4));
  const edge = float(1).sub(smoothstep(0.6, 1.6, min(edgeU, edgeV)));
  const floorLine = float(1).sub(smoothstep(0.6, 1.6, min(wv, float(1).sub(wv)).div(fwidth(gv).add(1e-4)))).mul(float(1).sub(roof)).mul(0.35);
  const lines = mix(mix(body.mul(0.22), lightU.mul(0.5), inWindow.mul(lit)), accentU, max(edge, floorLine));

  material.colorNode = vec4(mix(solid, lines, isLines), 1);

  let gridKey = '';
  let grid3: TerrainGrid = terrainGrid(initial.planeWidth, initial.planeDepth, initial.gridSegments);
  const blocks = new THREE.Mesh(new THREE.BufferGeometry(), material);
  // The vertex shader moves every block; the CPU bounds would be wrong.
  blocks.frustumCulled = false;
  scene.add(blocks);

  // The street plane, with avenue lights on every fourth block line and
  // dashes travelling with the city.
  const groundMaterial = new THREE.MeshBasicNodeMaterial({ fog: true });
  const avenueSpacing = cellSize.mul(4);
  const ax = abs(fract(positionWorld.x.div(avenueSpacing).add(0.5)).sub(0.5)).mul(avenueSpacing);
  const avenue = float(1).sub(smoothstep(cellSize.mul(0.02), cellSize.mul(0.06), ax));
  const dash = step(0.45, fract(positionWorld.z.div(cellSize).sub(waveU.w).mul(0.5)));
  const avenueGlow = avenue.mul(mix(0.2, 0.6, dash)).mul(float(1).sub(isLines.mul(0.3)));
  groundMaterial.colorNode = vec4(mix(groundU, avenueU, avenueGlow), 1);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.001;
  scene.add(ground);

  const raycaster = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();
  const ndc = new THREE.Vector2();
  let scroll = 0;
  let active = 0;
  let aspect = 1;
  const target = { x: 0, z: 0 };

  const rebuild = (o: TerrainOptions) => {
    const key = `${o.planeWidth}:${o.planeDepth}:${o.gridSegments}`;
    if (key === gridKey) return;
    gridKey = key;
    grid3 = terrainGrid(o.planeWidth, o.planeDepth, o.gridSegments);
    const arrays = buildBlockArrays(grid3.cols, grid3.rows);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(arrays.position, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(arrays.normal, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(arrays.uv, 2));
    geometry.setAttribute('aCell', new THREE.BufferAttribute(arrays.cell, 2));
    geometry.setIndex(new THREE.BufferAttribute(arrays.index, 1));
    blocks.geometry.dispose();
    blocks.geometry = geometry;
    // The street plane covers the blocks and a margin, no further: past the
    // far edge the clear colour is the sky, and avenues stop at the city.
    const span = grid3.cell * grid3.rows;
    ground.scale.set(o.planeWidth * 1.6, span + grid3.cell * 2, 1);
  };

  const placeCamera = (o: TerrainOptions) => {
    camera.fov = cameraFov(aspect);
    camera.aspect = aspect;
    camera.position.set(0, o.cameraHeight, o.cameraHeight * 1.4);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  };

  const update = (frame: ThreeFrame, o: TerrainOptions) => {
    rebuild(o);
    placeCamera(o);
    const palette = terrainPalette(o.district, o.lineColor, o.bgColor);
    setColor(clear, o.bgColor);
    renderer.setClearColor(clear, 1);
    fog.color.copy(clear);
    fog.density = o.fogDensity;
    scene.fog = o.fog ? fog : null;
    palette.bodies.forEach((c, i) => setColor(bodyU[i]!.value as THREE.Color, c));
    setColor(accentU.value as THREE.Color, palette.accent);
    setColor(lightU.value as THREE.Color, palette.light);
    setColor(groundU.value as THREE.Color, palette.ground);
    setColor(avenueU.value as THREE.Color, palette.avenue);

    // A one-off redraw (delta 0: paused, reduced motion, pointer moved while
    // still) snaps the pointer lift; a running loop eases it.
    scroll += frame.delta * o.scrollSpeed;
    // Keep the scroll small enough for float32 hashing; the wrap is a rows multiple, so no block jumps.
    if (scroll > grid3.rows * 400) scroll -= grid3.rows * 400;
    let want = 0;
    if (o.hoverEffect && frame.pointer.inside) {
      ndc.set(frame.pointer.x, frame.pointer.y);
      raycaster.setFromCamera(ndc, camera);
      if (raycaster.ray.intersectPlane(plane, hit)) {
        target.x = hit.x / grid3.cell;
        target.z = hit.z / grid3.cell + grid3.rows / 2 - 0.5;
        want = 1;
      }
    }
    active = frame.delta > 0 ? approach(active, want, frame.delta, 7) : want;
    const bumpBlocks = bumpInBlocks(o.bumpRadius, o.bumpStrength, grid3.cell);
    const [base, peak, centre, slab] = PROFILES[o.district];

    (gridU.value as THREE.Vector4).set(grid3.cols, grid3.rows, grid3.cell, HEIGHT_SCALE);
    (waveU.value as THREE.Vector4).set(o.waveAmplitude, o.waveFrequency, frame.time * o.waveSpeed, scroll);
    (profileU.value as THREE.Vector4).set(base, peak, centre, slab);
    (cursorU.value as THREE.Vector4).set(target.x, target.z, active, o.cursorEffect === 'ripple' ? 1 : 0);
    (bumpU.value as THREE.Vector4).set(bumpBlocks.radius, bumpBlocks.strength, frame.time, 0);
    (styleU.value as THREE.Vector4).set(o.variant === 'lines' ? 1 : 0, o.windowLights ? WINDOW_DENSITY[o.district] : 0, frame.time, 0);
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
      blocks.geometry.dispose();
      ground.geometry.dispose();
      material.dispose();
      groundMaterial.dispose();
    },
  };
}
