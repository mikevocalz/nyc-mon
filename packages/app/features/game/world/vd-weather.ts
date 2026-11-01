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
  // Per-drop speed variance (0.75–1.25×) — a uniform curtain reads as strobing rods.
  const speed = T.mix(T.float(21).mul(T.float(0.75).add(seed.x.mul(0.5))), T.float(1.2), snowing);
  const wobble = T.vec3(T.sin(T.time.mul(1.3).add(seed.x.mul(40))), 0, T.cos(T.time.mul(1.1).add(seed.z.mul(40)))).mul(snowing.mul(0.35));
  // Valdrada uWind (2.2, 1.1): rain drifts and the streak leans off vertical.
  const fall = T.vec3(T.time.mul(2.2), T.time.mul(speed).negate(), T.time.mul(1.1));
  const origin = T.cameraPosition.sub(box.mul(0.5));
  // Floored modulo: WGSL's float % keeps the dividend's sign and would break the wrap below zero.
  const rel = seed.mul(box).add(fall).add(wobble).sub(origin);
  const centre = rel.sub(box.mul(T.floor(rel.div(box)))).add(origin);
  // Streak: ~1.35 m by 1.6 cm for rain (per-drop length variance 0.7–1.3×),
  // an 8.5 cm flake for snow, facing the camera about the velocity axis.
  const length = T.mix(T.float(1.35).mul(T.float(0.7).add(seed.x.mul(0.6))), T.float(0.085), snowing);
  const width = T.mix(T.float(0.016), T.float(0.085), snowing);
  const vel = T.normalize(T.vec3(2.2, speed.negate(), 1.1));
  const toCam = T.normalize(T.cameraPosition.sub(centre));
  const side = T.normalize(T.cross(vel, toCam));
  const level = T.max(wet, snow);
  // Streaks past the level's share collapse to a point, and so do the ones
  // inside 1.5 m of the lens, which would otherwise smear across the frame.
  const shown = T.step(seed.y, level).mul(T.step(1.5, T.distance(centre, T.cameraPosition)));
  const streak = centre.add(side.mul(corner.x.mul(width))).add(vel.mul(corner.y.mul(length)));
  const position = T.mix(centre, streak, shown);

  const material = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, fog: true });
  material.blending = THREE.AdditiveBlending;
  material.positionNode = position;
  // Taper both axes like Valdrada's fragment shader: soft edges across the
  // streak and soft ends along it — without `along` every drop draws as a
  // hard-edged rod. Plus per-drop brightness variance.
  const u = corner.x.add(0.5);
  const across = T.smoothstep(0, 0.5, u).mul(T.smoothstep(1, 0.5, u));
  const along = T.smoothstep(0, 0.3, corner.y).mul(T.smoothstep(1, 0.55, corner.y));
  const alpha = T.mix(T.float(0.42), T.float(0.85), snowing).mul(across).mul(along).mul(T.float(0.6).add(seed.z.mul(0.4)));
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
