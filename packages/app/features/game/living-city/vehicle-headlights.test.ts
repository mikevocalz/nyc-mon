// N6 (slop-grade-city §9) started from the cases in mrdoob/slop-newyork @ be65d0a tests/vehicle-lights.test.cjs (MIT,
// © 2026 Mr.doob). Slop's two-beam SpotLight profile is gone: three r186's ClusteredLighting clusters only
// unshadowed PointLights, so each lit vehicle now gets one road-pool PointLight. What stays from Slop: placement
// under the vehicle's own matrix (yaw, slope, pooled reuse), the ranking and the flare maths.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { physicalVehicles } from '@acme/theme';
import { TIER } from '../perf/tier.ts';
import { frontLampMount } from './lofted-car.ts';
import {
  FLARE_STRIDE,
  HEADLIGHT_POOL,
  createCarFlareMaterial,
  createVehicleHeadlight,
  effectiveLightDistance,
  flareDistanceWeight,
  flareFacing,
  headlightLightCount,
  placeVehicleHeadlight,
  rankLitVehicles,
  smoothDistFade,
  writeVehicleFlares,
} from './vehicle-headlights.ts';
import {
  FLARE_MIN_SIZE,
  HEADLIGHT_MAX_DISTANCE,
  SLOP_GLOW_DAY,
  SLOP_GLOW_NIGHT,
  headlightBeamScale,
  slopGlowFromLampLevel,
} from './vehicle-physical-constants.ts';

const specs = {
  sedan: { zFront: 2.25 },
  suv: { zFront: 2.3 },
  bus: { zFront: 5.78 },
} as const;
const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-12, `${a} should equal ${b}`);
// three's Vector3.applyMatrix4 divides by w; Float32 matrix storage leaves ~1e-7 error, so world-space checks use this.
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-5, `${a} should equal ${b}`);

test('the pool light is an unshadowed PointLight in the low-beam colour, off until assigned', () => {
  const light = createVehicleHeadlight(THREE);
  assert.equal(light.isPointLight, true, 'r186 ClusteredLighting clusters PointLights only');
  assert.equal((light as unknown as { isSpotLight?: boolean }).isSpotLight, undefined);
  assert.equal(light.castShadow, false, 'a shadowed PointLight leaves the clusters');
  assert.equal(light.intensity, 0, 'pool lights remain off until assigned');
  assert.equal(light.distance, HEADLIGHT_POOL.distance);
  assert.equal(light.decay, HEADLIGHT_POOL.decay);
  assert.equal(light.color.getHexString(), new THREE.Color().setStyle(physicalVehicles.lamp.headBeam).getHexString());
});

for (const [name, spec] of Object.entries(specs)) {
  test(`${name}: the road pool sits on the centreline, ahead of the nose and low over the road`, () => {
    const light = createVehicleHeadlight(THREE);
    placeVehicleHeadlight(light, spec);
    close(light.position.x, 0);
    close(light.position.y, HEADLIGHT_POOL.height);
    close(light.position.z, spec.zFront + HEADLIGHT_POOL.ahead);
    assert.ok(light.position.y < 1.5, 'near road height');
    assert.ok(light.position.z - spec.zFront >= 2, 'a few metres past the bumper');
  });
}

test('the pool follows both yaw and slope at elevated road height, and a pooled light resets', () => {
  // A road climbing at 10%, facing +X: yaw = pi/2, pitch = -atan(.1), translated onto the viaduct.
  const pitch = -Math.atan(0.1);
  const s = Math.sin(pitch);
  const c = Math.cos(pitch);
  const matrix = new THREE.Matrix4().fromArray([0, 0, -1, 0, s, c, 0, 0, c, -s, 0, 0, 30, 7.6, -10, 1]);
  const local = createVehicleHeadlight(THREE);
  const world = createVehicleHeadlight(THREE);
  placeVehicleHeadlight(local, specs.suv);
  placeVehicleHeadlight(world, specs.suv, matrix);
  const a = local.position;
  const b = world.position;
  near(b.x, 30 + s * a.y + c * a.z);
  near(b.y, 7.6 + c * a.y - s * a.z);
  near(b.z, -10 - a.x);
  // Reusing a pooled light must reset local coordinates instead of accumulating the prior matrix transform.
  placeVehicleHeadlight(world, specs.suv);
  assert.deepEqual(world.position.toArray(), local.position.toArray());
});

test('the lofted bodies put their pools ahead of their own noses', () => {
  for (const kind of ['sedan', 'taxi', 'van', 'bus'] as const) {
    const m = frontLampMount(kind);
    const light = createVehicleHeadlight(THREE);
    placeVehicleHeadlight(light, { zFront: m.zFront });
    close(light.position.z, m.zFront + HEADLIGHT_POOL.ahead);
  }
});

// --- Tiers, night ramp, ranking -----------------------------------------------------------------------------------

test('tier pools: one light per lit vehicle, phone 8, high 24, from the tier row', () => {
  assert.equal(headlightLightCount('phone'), 8);
  assert.equal(headlightLightCount('high'), 24);
  assert.equal(headlightLightCount('phone'), TIER.phone.physical.headlightLights);
  assert.equal(headlightLightCount('high'), TIER.high.physical.headlightLights);
});

test('the night ramp: no beams by day, full by dusk, capped like Slop', () => {
  assert.equal(slopGlowFromLampLevel(0), SLOP_GLOW_DAY);
  assert.equal(slopGlowFromLampLevel(1), SLOP_GLOW_NIGHT);
  assert.equal(slopGlowFromLampLevel(-3), SLOP_GLOW_DAY, 'clamped');
  assert.equal(headlightBeamScale(0.24), 0, 'midday');
  assert.equal(headlightBeamScale(0.48), 0, 'golden hour');
  assert.ok(headlightBeamScale(1.25) > 0.9, 'dusk');
  assert.equal(headlightBeamScale(1.55), 1.28, 'night caps at 1.28');
});

test('effective distance penalises vehicles behind the camera, as Slop ranks them', () => {
  const focus = { x: 0, z: 0, fwdX: 0, fwdZ: 1 };
  const ahead = effectiveLightDistance(0, 20, focus);
  const behind = effectiveLightDistance(0, -20, focus);
  close(ahead, 20);
  close(behind, 20 + (5 + 20) * 3.2);
  close(effectiveLightDistance(0, -20, { x: 0, z: 0 }), 20);
  close(effectiveLightDistance(3, 4, { x: 0, z: 0, y: 12 }), 13);
});

test('rankLitVehicles: nearest first, capped, faded toward the cut-off, nothing past the max distance', () => {
  const focus = { x: 0, z: 0 };
  const positions = [5, 50, 10, 200, 30, 20].map((z) => ({ x: 0, z }));
  const lit = rankLitVehicles(positions, focus, 3);
  assert.deepEqual(lit.map((l) => l.index), [0, 2, 5], 'the three nearest, in order');
  // The cut-off shrinks to the first vehicle left out (30 m): fade runs 18.6 m to 30 m.
  assert.equal(lit[0]!.fade, 1);
  assert.equal(lit[1]!.fade, 1);
  close(lit[2]!.fade, smoothDistFade(20, 30 * 0.62, 30));
  assert.ok(lit[2]!.fade < 1 && lit[2]!.fade > 0);
  const all = rankLitVehicles(positions, focus, 10);
  assert.ok(all.every((l) => l.effDist < HEADLIGHT_MAX_DISTANCE), 'the 200 m car never gets a beam');
  assert.ok(!all.some((l) => l.index === 3));
  assert.deepEqual(rankLitVehicles([], focus, 8), []);
});

// --- Flares -------------------------------------------------------------------------------------------------------

test('flare weights: dark inside 40 m, full by 120 m, brightest head-on', () => {
  assert.equal(flareDistanceWeight(30), 0);
  assert.equal(flareDistanceWeight(40), 0);
  close(flareDistanceWeight(80), 0.5 / (1 + (80 / 2000) ** 2));
  close(flareDistanceWeight(120), 1 / (1 + (120 / 2000) ** 2));
  assert.equal(flareFacing(1), 1);
  assert.equal(flareFacing(-0.3), 0);
});

test('writeVehicleFlares: four sprites on the lamps, white ahead, red behind, sized at least the floor', () => {
  const pos = new Float32Array(8 * FLARE_STRIDE);
  const col = new Float32Array(8 * FLARE_STRIDE);
  const mount = { frontX: 0.59, frontY: 0.69, zFront: 2.25, rearX: 0.575, rearY: 0.795, zRear: -2.25 };
  // Car at 100 m straight ahead of a camera at the origin, driving toward it (yaw pi: forward is -Z).
  const next = writeVehicleFlares(pos, col, 0, { x: 0, z: 100, yaw: Math.PI }, mount, { x: 0, z: 0 }, 0.001);
  assert.equal(next, 4);
  // Front pair: nose toward the camera, so z = 100 - (2.25 + 0.3); white-ish and bright.
  near(pos[2]!, 100 - 2.55);
  near(pos[1]!, 0.69);
  assert.ok(col[0]! > 2 && col[1]! > 2 && col[2]! > 2);
  // Rear pair faces away: red, dim.
  near(pos[2 * FLARE_STRIDE + 2]!, 100 + 2.55);
  assert.ok(col[2 * FLARE_STRIDE]! > col[2 * FLARE_STRIDE + 1]! * 10, 'tail flares are red');
  assert.ok(col[2 * FLARE_STRIDE]! < col[0]!, 'the tail faces away and is dimmer');
  assert.ok(pos[3]! >= FLARE_MIN_SIZE);
  // Too close: no sprites, slot unchanged.
  assert.equal(writeVehicleFlares(pos, col, 4, { x: 0, z: 10, yaw: 0 }, mount, { x: 0, z: 0 }, 0.001), 4);
  // Full buffer: no write past the end.
  assert.equal(writeVehicleFlares(pos, col, 6, { x: 0, z: 100, yaw: 0 }, mount, { x: 0, z: 0 }, 0.001), 6);
});

test('the flare material is an additive, fogless sprite reading flarePos and flareCol', () => {
  const glow = THREE.TSL.uniform(1.4);
  const mat = createCarFlareMaterial(THREE, glow);
  assert.equal((mat as { isSpriteNodeMaterial?: boolean }).isSpriteNodeMaterial, true);
  assert.equal(mat.blending, THREE.AdditiveBlending);
  assert.equal(mat.depthWrite, false);
  assert.equal(mat.fog, false);
  assert.equal(mat.transparent, true);
  assert.ok(mat.positionNode && mat.scaleNode && mat.colorNode);
  mat.dispose();
});
