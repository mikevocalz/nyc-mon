// Raised sidewalks on the vd lane: CURB_HEIGHT is read from the env at
// import, so this file sets the flag before importing the world.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';

process.env.EXPO_PUBLIC_WORLD_VD = '1';

test('vd lane: ground, lots and sidewalks ride the curb, faces stand along the carriageways', async () => {
  const { CURB_HEIGHT } = await import('./curb.ts');
  const { parseCityDataset } = await import('../city-dataset.ts');
  const { buildCityWorld } = await import('./index.ts');
  const { createWalkQueries, createStreetClearance } = await import('./walkability.ts');
  assert.ok(CURB_HEIGHT > 0.1 && CURB_HEIGHT < 0.2);
  const dataset = parseCityDataset(JSON.parse(readFileSync(new URL('../data/harlem-apollo.json', import.meta.url), 'utf8')));
  const world = buildCityWorld(THREE as never, dataset, { vd: true });

  const walks = world.group.getObjectByName('city:sidewalks') as THREE.Mesh;
  const normals = walks.geometry.getAttribute('normal');
  let faces = 0;
  for (let i = 0; i < normals.count; i++) if (Math.abs(normals.getY(i)) < 0.01) faces++;
  assert.ok(faces > 1000, `${faces} curb-face vertices`);
  assert.equal((walks.material as THREE.Material).depthWrite, false);
  assert.ok(walks.renderOrder < 0);
  const ground = world.group.getObjectByName('city:ground')!;
  assert.equal(ground.position.y, CURB_HEIGHT);

  // The Caller stands on the curb off the road and at road level on it.
  const walk = createWalkQueries(dataset);
  const clearance = createStreetClearance(dataset);
  // Probe each primary segment's midpoint, and a point 1.5 m past its curb.
  let checked = 0;
  for (const road of dataset.roads.filter((r) => r.class === 'primary').slice(0, 20)) {
    const p = road.points;
    if (p.length < 4) continue;
    const [ax, az, bx, bz] = [p[0]!, p[1]!, p[2]!, p[3]!];
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 4) continue;
    const mx = (ax + bx) / 2; const mz = (az + bz) / 2;
    const nx = (bz - az) / len; const nz = -(bx - ax) / len;
    assert.equal(walk.groundHeight(mx, mz), 0, 'road centre is at road level');
    const off = road.widthMeters / 2 + 1.5;
    const [sx, sz] = [mx + nx * off, mz + nz * off];
    if (clearance.inCarriageway(sx, sz, 0)) continue;
    assert.equal(walk.groundHeight(sx, sz), CURB_HEIGHT, 'past the curb is curb height');
    checked++;
  }
  assert.ok(checked >= 3, `${checked} curb probes`);
  world.dispose();
});

test('vd lane: near trees are Valdrada’s census species, filled around the Caller and under the triangle budget', async () => {
  const { parseCityDataset } = await import('../city-dataset.ts');
  const { buildCityWorld } = await import('./index.ts');
  const { VD_NEAR_TREE_CAP, vdCensusTree } = await import('./vd-trees-mesh.ts');
  const { VD_CENSUS_SPECIES } = await import('./vd-tree-species.ts');
  const { decodeBase64 } = await import('./foliage-decode.ts');
  // Census species map onto the baked models: honeylocust (2) -> 1, oak (5) -> 2, pear (3) -> 3.
  const sp = decodeBase64(VD_CENSUS_SPECIES);
  const first = (id: number) => sp.indexOf(id);
  assert.equal(vdCensusTree(first(2)).model, 1);
  assert.equal(vdCensusTree(first(5)).model, 2);
  assert.equal(vdCensusTree(first(3)).model, 3);
  const dataset = parseCityDataset(JSON.parse(readFileSync(new URL('../data/harlem-apollo.json', import.meta.url), 'utf8')));
  const world = buildCityWorld(THREE as never, dataset, { vd: true });
  world.setViewDistance(8, 2000);
  world.setFocus(-28, 22);
  const leaves = world.group.children.filter((o) => o.name.startsWith('city:trees-vd-leaf-')) as THREE.InstancedMesh[];
  const barks = world.group.children.filter((o) => o.name.startsWith('city:trees-vd-bark-')) as THREE.InstancedMesh[];
  assert.equal(leaves.length, 6);
  assert.equal(barks.length, 6);
  const shown = leaves.reduce((n, m) => n + m.count, 0);
  assert.ok(shown > 10 && shown <= VD_NEAR_TREE_CAP, `${shown} model trees near the Apollo`);
  let tris = 0;
  for (const m of [...leaves, ...barks]) tris += (m.geometry.index!.count / 3) * m.count;
  assert.ok(tris < 600_000, `${tris} model-tree triangles`);
  // Trees stand on the curb.
  const row = new THREE.Matrix4();
  leaves.find((m) => m.count > 0)!.getMatrixAt(0, row);
  assert.ok(Math.abs(new THREE.Vector3().setFromMatrixPosition(row).y - 0.14) < 1e-6);
  world.dispose();
});

test('vd lane: Valdrada’s measured 125th Street shops reach the sign lettering', async () => {
  const { parseCityDataset } = await import('../city-dataset.ts');
  const { buildCityMeshes } = await import('./city-mesh.ts');
  const { createCityMaterials } = await import('./materials.ts');
  const { VD_STOREFRONTS } = await import('./vd-storefronts.ts');
  const dataset = parseCityDataset(JSON.parse(readFileSync(new URL('../data/harlem-apollo.json', import.meta.url), 'utf8')));
  const materials = createCityMaterials(THREE as never, [0.5, 0.5, 0.7]);
  const city = buildCityMeshes(THREE as never, dataset, materials, [1, 0]);
  const words = new Set(city.texts.map((t) => t.text));
  for (const name of ['CHIPOTLE', 'POPEYES', 'CAPITAL ONE BANK']) assert.ok(words.has(name), `${name} is on a sign`);
  assert.ok(VD_STOREFRONTS.length > 100);
  city.dispose(); materials.dispose();
});
