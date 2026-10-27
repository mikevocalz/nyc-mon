// N6 (slop-grade-city §9): the cases from mrdoob/slop-newyork @ be65d0a tests/vehicle-lights.test.cjs (MIT, © 2026
// Mr.doob), run against three's real SpotLight, Vector3 and Matrix4 instead of Slop's mocks. The specs below are
// that test's own fixtures, copied unchanged. Then the parts this port adds: the tiered pool, the ranking and the
// flare maths.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { physicalVehicles } from '@acme/theme';
import { frontLampMount } from './lofted-car.ts';
import {
  FLARE_STRIDE,
  HEADLIGHTS,
  createCarFlareMaterial,
  createVehicleHeadlight,
  effectiveLightDistance,
  flareDistanceWeight,
  flareFacing,
  headlightSpotCount,
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
  sedan: { headlight: [0.56, 0.705], zFront: 2.25 },
  suv: { headlight: [0.6, 0.9], zFront: 2.3 },
  bus: { headlight: [0.79, 0.8], zFront: 5.78 },
} as const;
const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-12, `${a} should equal ${b}`);
// three's Vector3.applyMatrix4 divides by w; Float32 matrix storage leaves ~1e-7 error, so world-space checks use this.
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-5, `${a} should equal ${b}`);

test('the shared profile creates ordinary unshadowed spots with no cookie or custom light node', () => {
  const spot = createVehicleHeadlight(THREE);
  assert.equal(spot.intensity, 0, 'pool lights remain off until assigned');
  assert.equal(spot.distance, HEADLIGHTS.distance);
  assert.equal(spot.angle, HEADLIGHTS.angle);
  assert.equal(spot.penumbra, HEADLIGHTS.penumbra);
  assert.equal(spot.decay, 2);
  assert.ok(spot.penumbra >= 0 && spot.penumbra <= 1);
  assert.equal(spot.color.getHexString(), new THREE.Color().setStyle(physicalVehicles.lamp.headBeam).getHexString());
  placeVehicleHeadlight(spot, specs.sedan, 1);
  assert.equal(spot.map, null);
  assert.equal((spot as unknown as { colorNode?: unknown }).colorNode ?? null, null);
  assert.equal(spot.castShadow, false);
});

for (const [name, spec] of Object.entries(specs)) {
  test(`${name} beams originate at the modeled lamps and stay below the chassis horizon`, () => {
    for (const side of [-1, 1]) {
      const spot = createVehicleHeadlight(THREE);
      placeVehicleHeadlight(spot, spec, side);
      close(spot.position.x, side * spec.headlight[0]);
      close(spot.position.y, spec.headlight[1]);
      close(spot.position.z, spec.zFront + HEADLIGHTS.noseOffset);
      const dx = spot.target.position.x - spot.position.x;
      const dy = spot.target.position.y - spot.position.y;
      const dz = spot.target.position.z - spot.position.z;
      assert.ok(dz > 0 && dx * side > 0, 'the beam points forward with a slight outward angle');
      close(dx / dz, side * HEADLIGHTS.toeOut);
      close(-dy / dz, Math.tan(HEADLIGHTS.pitch));
      const downwardAngle = Math.atan2(-dy, Math.hypot(dx, dz));
      assert.ok(downwardAngle > spot.angle, 'the entire cone stays below the local horizon, including toe-out');
    }
  });
}

test('lamp and target follow both yaw and slope at elevated road height', () => {
  // A road climbing at 10%, facing +X: yaw = pi/2, pitch = -atan(.1), translated onto the viaduct.
  const pitch = -Math.atan(0.1);
  const s = Math.sin(pitch);
  const c = Math.cos(pitch);
  const matrix = new THREE.Matrix4().fromArray([0, 0, -1, 0, s, c, 0, 0, c, -s, 0, 0, 30, 7.6, -10, 1]);
  const local = createVehicleHeadlight(THREE);
  const world = createVehicleHeadlight(THREE);
  placeVehicleHeadlight(local, specs.suv, -1);
  placeVehicleHeadlight(world, specs.suv, -1, matrix);
  for (const [a, b] of [[local.position, world.position], [local.target.position, world.target.position]] as const) {
    near(b.x, 30 + s * a.y + c * a.z);
    near(b.y, 7.6 + c * a.y - s * a.z);
    near(b.z, -10 - a.x);
  }
  const dx = world.target.position.x - world.position.x;
  const dy = world.target.position.y - world.position.y;
  const dz = world.target.position.z - world.position.z;
  const vertical = dx * s + dy * c; // dot with the elevated road's up vector
  const horizontal = Math.sqrt(dx * dx + dy * dy + dz * dz - vertical * vertical);
  assert.ok(Math.atan2(-vertical, horizontal) > world.angle, 'the transformed cone stays below the road-relative horizon');
  // Reusing a pooled light must reset local coordinates instead of accumulating the prior matrix transform.
  placeVehicleHeadlight(world, specs.suv, -1);
  assert.deepEqual(world.position.toArray(), local.position.toArray());
  assert.deepEqual(world.target.position.toArray(), local.target.position.toArray());
});

test('the lofted bodies mount their beams on their own lamps', () => {
  for (const kind of ['sedan', 'taxi', 'van', 'bus'] as const) {
    const m = frontLampMount(kind);
    const spot = createVehicleHeadlight(THREE);
    placeVehicleHeadlight(spot, { headlight: [m.x, m.y], zFront: m.zFront }, 1);
    close(spot.position.x, m.x);
    close(spot.position.z, m.zFront + HEADLIGHTS.noseOffset);
    assert.ok(m.y > 0.6 && m.y < 1, `${kind} lamp height ${m.y}`);
  }
});

// --- Tiers, night ramp, ranking -----------------------------------------------------------------------------------

test('tier pools: phone lights 8 vehicles, high 24, two spots each', () => {
  assert.equal(headlightSpotCount('phone'), 16);
  assert.equal(headlightSpotCount('high'), 48);
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
