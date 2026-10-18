// Falling rain and snow for the vd lane, ported from Valdrada
// client/src/world/weather.js (v0.4.0): camera-wrapped streaks, each
// position `mod(seed·vol + vel·t − origin, vol) + origin`, stretched along
// its fall. One draw call; the count drawn scales with the level.
//
// Valdrada draws up to 46k rain and 30k snow quads in 150×70×150 m. The phone
// gets a smaller box and fewer streaks. Unlit, additive, no depth write.
import type { Three } from '@acme/ui/three';
import type { Node } from 'three/webgpu';
import { cityShaderTools } from './materials.ts';

// ponytail: fixed 6k streaks in a 60×30×60 m box around the camera; raise both together if
// the Duo frame budget allows, since density reads from count / volume.
const COUNT = 6000;
const BOX = [60, 30, 60] as const;

export function buildPrecipitation(THREE: Three, levels: { wet: { value: number }; snow: { value: number } }) {
  const { T, c } = cityShaderTools(THREE);
  // A unit quad per streak, the per-streak seed in the second uv set.
  const positions = new Float32Array(COUNT * 6 * 3);
  const corners = new Float32Array(COUNT * 6 * 2);
  const seeds = new Float32Array(COUNT * 6 * 3);
  const quad = [[-0.5, 0], [0.5, 0], [0.5, 1], [-0.5, 0], [0.5, 1], [-0.5, 1]] as const;
  let s = 1;
  const rand = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < COUNT; i++) {
    const seed = [rand(), rand(), rand()];
    for (let k = 0; k < 6; k++) {
      const v = i * 6 + k;
      corners.set(quad[k]!, v * 2);
      seeds.set(seed, v * 3);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aCorner', new THREE.BufferAttribute(corners, 2));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));

  const wet = levels.wet as unknown as Node<'float'>;
  const snow = levels.snow as unknown as Node<'float'>;
  const corner = T.attribute<'vec2'>('aCorner', 'vec2');
  const seed = T.attribute<'vec3'>('aSeed', 'vec3');
  const box = T.vec3(BOX[0], BOX[1], BOX[2]);
  const snowing = T.step(0.5, snow.sub(wet).add(0.5));
  // Rain falls at 21 m/s (Valdrada), snow at 1.2 m/s with a sine wobble.
  const speed = T.mix(T.float(21), T.float(1.2), snowing);
  const wobble = T.vec3(T.sin(T.time.mul(1.3).add(seed.x.mul(40))), 0, T.cos(T.time.mul(1.1).add(seed.z.mul(40)))).mul(snowing.mul(0.35));
  const fall = T.vec3(0, T.time.mul(speed).negate(), 0);
  const origin = T.cameraPosition.sub(box.mul(0.5));
  // Floored modulo: WGSL's float % keeps the dividend's sign and would break the wrap below zero.
  const rel = seed.mul(box).add(fall).add(wobble).sub(origin);
  const centre = rel.sub(box.mul(T.floor(rel.div(box)))).add(origin);
  // Streak: 1.35 m by 1.6 cm for rain, an 8 cm flake for snow, facing the camera about the fall axis.
  const length = T.mix(T.float(1.35), T.float(0.08), snowing);
  const width = T.mix(T.float(0.016), T.float(0.08), snowing);
  const toCam = T.normalize(T.cameraPosition.sub(centre));
  const side = T.normalize(T.cross(T.vec3(0, 1, 0), toCam));
  const level = T.max(wet, snow);
  // Streaks past the level's share collapse to a point, and so do the ones
  // inside 1.5 m of the lens, which would otherwise smear across the frame.
  const shown = T.step(seed.y, level).mul(T.step(1.5, T.distance(centre, T.cameraPosition)));
  const streak = centre.add(side.mul(corner.x.mul(width))).add(T.vec3(0, corner.y.mul(length), 0));
  const position = T.mix(centre, streak, shown);

  const material = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, fog: true });
  material.blending = THREE.AdditiveBlending;
  material.positionNode = position;
  const alpha = T.mix(T.float(0.42), T.float(0.8), snowing).mul(T.float(1).sub(T.abs(corner.x).mul(1.6)));
  material.colorNode = T.vec4(T.mix(c('rain'), c('snow'), snowing), alpha);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'city:precipitation';
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;
  return {
    mesh,
    /** Hidden while the sky is clear, so it costs nothing then. */
    update() { mesh.visible = Math.max(levels.wet.value, levels.snow.value) > 0.01; },
    dispose() { geometry.dispose(); material.dispose(); },
  };
}
