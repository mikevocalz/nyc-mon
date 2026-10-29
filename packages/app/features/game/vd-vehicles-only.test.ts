// "I don't want to see all the old cars, new stuff only" (2026-10-28). Under
// the default flags (physical + vd) every car and bus the scene draws, parked
// or moving, near or far, is a Valdrada baked body: each vehicle mesh's index
// buffer is one of the baked bodies' own level lists (vd-car-mesh.ts
// lodIndices), so no box car, lofted body, lofted proxy or lofted bus can be
// in the scene. The chase-camera vehicle triangle count stays in budget while
// walking.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

process.env.EXPO_PUBLIC_WORLD_PHYSICAL = '1';
delete process.env.EXPO_PUBLIC_WORLD_VD;
delete process.env.EXPO_PUBLIC_WORLD_PROBE;
delete process.env.EXPO_PUBLIC_WORLD_TIER;

/**
 * Vehicle triangles at the chase camera, parked and moving together, on the Apollo tile with 48 moving vehicles
 * (12 of each kind). Measured 2026-10-28 along the walk: 80k-181k. LOD2 for the 12 nearest parked cars inside 40 m
 * and for moving vehicles inside 40 m (up to the tier's near cap); the `mid` body (~550-1500 triangles) past that,
 * the parked `far` body (~120-400) past 90 m. The same walk before this change, with box parked cars, the lofted bus
 * and LOD2 for each kind's 12 nearest at any distance, came to 194k-245k. The cap is the measured max plus ~10 %.
 */
const VEHICLE_TRIANGLE_BUDGET = 200_000;

/** Not bodies: the light quads, flares and the headlight group. */
const NOT_A_BODY = /vehicle-lights|vehicle-flares|vehicle-headlights/;

test('default flags: every vehicle mesh is a baked Valdrada body at one of its levels; chase triangles in budget', async () => {
  const THREE = await import('three/webgpu');
  const { parseCityDataset } = await import('./city-dataset.ts');
  const { createCityScene } = await import('./city-scene.ts');
  const { createVehicleActor } = await import('./living-city/vehicle-actor.ts');
  const { DEFAULT_ENV_STATE, packEnvSection } = await import('./living-city/clock.ts');
  const { emptyPedSection } = await import('./living-city/ped-sim.ts');
  const { emptySignalSection } = await import('./living-city/signal-viz.ts');
  const { VSNAP_STRIDE } = await import('./living-city/vehicle-sim.ts');
  const { decodeVdCar, VD_CAR_IDS, VD_LODS } = await import('./world/vd-car-mesh.ts');
  const { visibleTriangles } = await import('./world/budget.ts');

  const dataset = parseCityDataset(JSON.parse(readFileSync(new URL('./data/harlem-apollo.json', import.meta.url), 'utf8')));
  // 48 moving vehicles of every kind along 125th Street, 8 m apart, both directions.
  const records: number[][] = [];
  for (let i = 0; i < 48; i++) {
    const x = -228 + i * 8;
    const z = 22 + (i % 2 ? 4 : -4);
    records.push([100 + i, i % 4, x, z, 0, x, z, 0, 5, 0, 9, 0]);
  }
  const snap = [
    1, 1, 1 / 24, records.length, VSNAP_STRIDE, 3, 0, 0, ...records.flat(), ...emptyPedSection(), ...emptySignalSection(),
    ...packEnvSection({ ...DEFAULT_ENV_STATE, lampLevel: 1, headlights: 1 }, 3),
  ];
  const camera = { x: -28, z: 22, yaw: Math.PI / 2, distance: 8 };
  const params = { dataset, camera };
  const built = createCityScene({ THREE } as never, {
    ...params,
    actors: [createVehicleActor({ read: () => snap, focus: () => ({ x: params.camera.x, z: params.camera.z, fwdX: -1, fwdZ: 0 }) })],
  } as never);

  // Every index list a baked body owns.
  const baked = new Map<ArrayBufferView, string>();
  for (const id of VD_CAR_IDS) for (const lod of VD_LODS) baked.set(decodeVdCar(id).lodIndices[lod], `${id}:${lod}`);

  type Mesh = { name: string; visible: boolean; isMesh?: boolean; count?: number; geometry: { index: { array: ArrayBufferView } | null } };
  const vehicleMeshes = () => {
    const out: Mesh[] = [];
    (built.scene as unknown as { traverse(f: (o: Mesh) => void): void }).traverse((o) => {
      if (o.isMesh && /^(city:cars|living-city:vehicles)/.test(o.name) && !NOT_A_BODY.test(o.name)) out.push(o);
    });
    return out;
  };

  const used = new Set<string>();
  const frame = { delta: 1 / 60, time: 1, reducedMotion: false };
  const check = (label: string) => {
    built.update!(frame as never, params as never);
    const meshes = vehicleMeshes();
    assert.ok(meshes.length > 0, `${label}: vehicle meshes mounted`);
    for (const m of meshes) {
      const body = m.geometry.index ? baked.get(m.geometry.index.array) : undefined;
      assert.ok(body, `${label}: ${m.name} is not a baked Valdrada body (box or lofted geometry in the scene)`);
      if ((m.count ?? 1) > 0 && m.visible) used.add(body);
    }
    const names = new Set(meshes.map((m) => m.name));
    assert.ok(!names.has('city:cars'), 'no box parked cars');
    for (const kind of ['sedan', 'taxi', 'van', 'bus']) {
      for (const lofted of ['', ':near', ':far']) assert.ok(!names.has(`living-city:vehicles:${kind}${lofted}`), `no lofted or box ${kind}${lofted}`);
    }
    const tris = visibleTriangles(built.scene as never).meshes
      .filter((m) => /^(city:cars|living-city:vehicles)/.test(m.name) && !NOT_A_BODY.test(m.name))
      .reduce((s, m) => s + m.triangles, 0);
    assert.ok(tris <= VEHICLE_TRIANGLE_BUDGET, `${label}: ${tris} vehicle triangles`);
    return tris;
  };

  const counts: string[] = [];
  for (const distance of [8, 18, 40]) {
    params.camera = { ...camera, distance };
    counts.push(`chase ${distance} m: ${check(`chase ${distance} m`)}`);
  }
  for (let x = -28; x > -428; x -= 25) {
    params.camera = { ...camera, x };
    counts.push(`x=${x}: ${check(`x=${x}`)}`);
  }
  console.info('[vd-vehicles] triangles', counts.join(', '));
  // All three levels and the bus are actually drawn on the walk.
  for (const lod of VD_LODS) assert.ok([...used].some((b) => b.endsWith(`:${lod}`)), `some vehicle draws the ${lod} level`);
  assert.ok([...used].some((b) => b.startsWith('mtaxd40:')), 'the baked bus draws');
  built.dispose!();
});
