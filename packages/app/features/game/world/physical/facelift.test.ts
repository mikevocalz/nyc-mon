// The physical facelift (facelift.ts, future-layer.ts faceliftPlan): the
// density table drives deterministic per-building plans, every glow token
// clears every preset's bloom threshold, the skin reuses city-mesh.ts's own
// wall attributes, the kit is covered rather than duplicated, the layer
// adds exactly one draw, and the materials compile to WGSL. Measured on the
// real Harlem tile where it matters.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { physicalFacelift } from '@acme/theme';
import { parseCityDataset } from '../../city-dataset.ts';
import { buildCityMeshes } from '../city-mesh.ts';
import {
  classifyFaceliftBlock, FACELIFT_BLOCKS, FACELIFT_DENSITY, faceliftPlan, type FaceliftBlock, type FaceliftDensity,
} from '../future-layer.ts';
import { CITY_COLORS, hexToRgb } from '../palette.ts';
import { createPbrCityMaterials } from '../pbr-materials.ts';
import { PHYSICAL_GRADE, PHYSICAL_POST } from '../physical-look.ts';
import { createStreetClearance } from '../walkability.ts';
import { FACADE_WALL_ATTRIBUTE, WALL_KINDS } from './facade-attributes.ts';
import {
  bloomLuminance, buildPhysicalFacelift, ccwRing, createFaceliftAdMaterial, doorBayCentre, FACELIFT_ATTRIBUTE, FACELIFT_GLOW,
  faceliftWallTone, FACELIFT_STREETLIGHT, kitEntrance, srgbToLinear,
} from './facelift.ts';
import { buildPhysicalCityMaterials } from './index.ts';
import { compileWgsl, stubRenderer, testUniforms } from './physical.test-support.ts';

const realTile = () => parseCityDataset(JSON.parse(readFileSync(new URL('../../data/harlem-apollo.json', import.meta.url), 'utf8')));

function physicalCity(dataset: ReturnType<typeof realTile>) {
  const physical = buildPhysicalCityMaterials(THREE, testUniforms(), dataset);
  const base = createPbrCityMaterials(THREE, { sunDirection: [0.5, -0.5, 0.7] });
  const materials = { ...base, masonry: physical.masonry, glass: physical.glass, roads: physical.roads, sidewalks: physical.sidewalks };
  const clearance = createStreetClearance(dataset);
  const city = buildCityMeshes(THREE, dataset, materials, [0.5, -0.5], clearance, true, { facadeAttributes: true, fireEscapes: true });
  return { city, clearance, dispose: () => { city.dispose(); base.dispose(); physical.dispose(); } };
}

test('the density table is complete, in range, and FUT-01-clean', () => {
  assert.deepEqual(Object.keys(FACELIFT_DENSITY).sort(), [...FACELIFT_BLOCKS].sort());
  for (const [block, row] of Object.entries(FACELIFT_DENSITY)) {
    for (const [piece, value] of Object.entries(row)) {
      if (typeof value === 'number' && piece !== 'panelMinFloors') assert.ok(value >= 0 && value <= 1, `${block}.${piece} = ${value}`);
    }
  }
  // The handoff's row values, pinned so a change is a visible diff.
  assert.equal(FACELIFT_DENSITY.avenue.frames, 0.6);
  assert.equal(FACELIFT_DENSITY.brownstoneSide.trim, 0.1);
  assert.equal(FACELIFT_DENSITY.walkUp.balcony, 0.15);
  assert.equal(FACELIFT_DENSITY.glass.verticalLight, 0.3);
  assert.equal(FACELIFT_DENSITY.projectTower.celKit, true);
  // No block type, token key or plan field names NYCHA: the class is a look until FUT-01 closes.
  const names = [...FACELIFT_BLOCKS, ...Object.keys(physicalFacelift), ...Object.keys(faceliftPlan({ id: 'x', heightMeters: 20 }, 'avenue', 0.5))];
  for (const name of names) assert.ok(!/nycha/i.test(name), name);
});

test('block classification: landmarks and stone first, then towers, glass, avenue frontage, side streets', () => {
  const b = (c: Parameters<typeof classifyFaceliftBlock>[0]['class'], h = 20) => ({ class: c, heightMeters: h });
  assert.equal(classifyFaceliftBlock(b('brick'), { landmark: true, onAvenue: true }), 'civic');
  assert.equal(classifyFaceliftBlock(b('church'), { landmark: false, onAvenue: true }), 'civic');
  assert.equal(classifyFaceliftBlock(b('nycha', 50), { landmark: false, onAvenue: true }), 'projectTower');
  assert.equal(classifyFaceliftBlock(b('glass'), { landmark: false, onAvenue: true }), 'glass');
  assert.equal(classifyFaceliftBlock(b('brownstone'), { landmark: false, onAvenue: true }), 'avenue');
  assert.equal(classifyFaceliftBlock(b('brownstone'), { landmark: false, onAvenue: false }), 'brownstoneSide');
  assert.equal(classifyFaceliftBlock(b('brick', 12), { landmark: false, onAvenue: false }), 'walkUp');
  assert.equal(classifyFaceliftBlock(b('brick', 32), { landmark: false, onAvenue: false }), 'walkUp');
  assert.equal(classifyFaceliftBlock(b('brick', 9), { landmark: false, onAvenue: false }), 'other');
  assert.equal(classifyFaceliftBlock(b('plain'), { landmark: false, onAvenue: false }), 'other');
});

test('plans are deterministic per id, follow the shares, and trims stay a subset of the cel trims', () => {
  const ids = Array.from({ length: 4000 }, (_, i) => ({ id: `osm:way:${1000 + i * 7}`, heightMeters: 24, floors: 7 }));
  const share = (block: FaceliftBlock, piece: 'frames' | 'palette' | 'panels' | 'entrance' | 'balcony') =>
    ids.filter((b) => faceliftPlan(b, block, 0.5)[piece]).length / ids.length;
  assert.ok(Math.abs(share('avenue', 'frames') - 0.6) < 0.03, `${share('avenue', 'frames')}`);
  assert.ok(Math.abs(share('avenue', 'panels') - 0.25) < 0.03);
  assert.ok(Math.abs(share('walkUp', 'balcony') - 0.15) < 0.03);
  assert.equal(share('civic', 'frames'), 0);
  assert.equal(share('projectTower', 'frames'), 1);
  assert.deepEqual(faceliftPlan(ids[3]!, 'avenue', 0.5), faceliftPlan(ids[3]!, 'avenue', 0.5));
  // Panels wait for the floor floor.
  assert.equal(faceliftPlan({ id: 'low', heightMeters: 9, floors: 3 }, 'avenue', 0.5, {
    ...FACELIFT_DENSITY, avenue: { ...FACELIFT_DENSITY.avenue, panels: 1 },
  }).panels, false);
  // A trim is planned only where the cel city's own trim hash already trims.
  for (const b of ids.slice(0, 500)) {
    for (const block of FACELIFT_BLOCKS) {
      if (faceliftPlan(b, block, 0.4).trim) assert.ok(faceliftPlan(b, 'other', 0.4).trim, `${b.id} ${block}`);
    }
  }
  // Changing one number moves one piece and nothing else.
  const tweaked: Record<FaceliftBlock, FaceliftDensity> = { ...FACELIFT_DENSITY, walkUp: { ...FACELIFT_DENSITY.walkUp, frames: 0.9 } };
  for (const b of ids.slice(0, 300)) {
    const a = faceliftPlan(b, 'walkUp', 0.5);
    const c = faceliftPlan(b, 'walkUp', 0.5, tweaked);
    assert.deepEqual({ ...a, frames: c.frames }, c);
  }
});

test('every glow token clears every preset bloom threshold, through exposure, balance and the peak limit', () => {
  const glowTokens = [...physicalFacelift.trim, ...physicalFacelift.strip, physicalFacelift.entrance, physicalFacelift.kerb];
  for (const preset of Object.keys(PHYSICAL_GRADE) as (keyof typeof PHYSICAL_GRADE)[]) {
    const needed = PHYSICAL_GRADE[preset].threshold + 0.3; // BloomNode smoothWidth, post/pipeline.ts
    for (const hex of glowTokens) {
      const lum = bloomLuminance(hex, preset);
      assert.ok(lum >= needed, `${hex} at ${preset}: ${lum.toFixed(2)} < ${needed}`);
    }
    // The billboard gradients are the cel brand neon keys.
    for (const key of ['neonOrange', 'neonRoyal', 'neonCarolina', 'neonApple', 'neonLeaf'] as const) {
      const lum = bloomLuminance(CITY_COLORS[key], preset, FACELIFT_GLOW.adTarget);
      assert.ok(lum >= needed, `${key} ad at ${preset}: ${lum.toFixed(2)}`);
    }
  }
  assert.equal(PHYSICAL_POST.bloomSmoothWidth, 0.3);
  assert.equal(srgbToLinear(1), 1);
  assert.ok(Math.abs(srgbToLinear(0.5) - 0.214) < 1e-3);
});

test('the LED streetlight is cooler than the sodium-warm pools; refreshed tones come from the family', () => {
  const blueOverRed = (hex: string) => { const [r, , b] = hexToRgb(hex); return b / r; };
  assert.ok(blueOverRed(FACELIFT_STREETLIGHT.color) > 1);
  assert.ok(blueOverRed(FACELIFT_STREETLIGHT.color) > blueOverRed(CITY_COLORS.lampHalo) * 1.5);
  assert.equal(faceliftWallTone({ id: 'a', class: 'brick' }, { palette: false }), null);
  assert.equal(faceliftWallTone({ id: 'a', class: 'glass' }, { palette: true }), null);
  assert.ok((physicalFacelift.wallRefresh.brick as readonly string[]).includes(faceliftWallTone({ id: 'a', class: 'nycha' }, { palette: true })!));
  assert.ok((physicalFacelift.wallRefresh.brownstone as readonly string[]).includes(faceliftWallTone({ id: 'b', class: 'brownstone' }, { palette: true })!));
});

test('door bay: the centre of the bay the pre-war shader puts the door in', () => {
  // 10 m wall, 1.2 m piers, 1.7 m window module: 4 bays of 1.9 m. Tone 0.5 -> bay 2.
  const { s, bayWidth } = doorBayCentre(10, [3.2, 1.7, 42 + 0.1 + 0.8 * 0.5, 1 * 4 + 1.2]);
  assert.ok(Math.abs(bayWidth - 1.9) < 1e-9);
  assert.ok(Math.abs(s - (1.2 + 2.5 * 1.9)) < 1e-9);
});

test('real tile: one more draw, skin copied from city-mesh walls, the kit covered not duplicated, civic untouched', () => {
  const dataset = realTile();
  const { city, clearance, dispose } = physicalCity(dataset);
  const before = new Map(city.meshes.map((m) => [m.name, Object.fromEntries(Object.entries(m.geometry.attributes).map(([k, a]) => [k, (a.array as Float32Array).slice()]))]));
  const billboardsMaterial = city.meshes.find((m) => m.name === 'city:billboards')!.material;
  const facelift = buildPhysicalFacelift(THREE, dataset, city.meshes, clearance);
  const s = facelift.stats;

  // Draw calls: the city's 12 plus the one facelift mesh. The billboards swap material, not mesh.
  assert.equal(city.stats.drawCalls, 12);
  assert.ok(facelift.mesh);
  assert.notEqual(city.meshes.find((m) => m.name === 'city:billboards')!.material, billboardsMaterial);

  // The city geometry is read, never written.
  for (const m of city.meshes) {
    for (const [k, a] of Object.entries(m.geometry.attributes)) assert.deepEqual(a.array, before.get(m.name)![k], `${m.name}.${k}`);
  }

  // Every block counted once; the kit's towers keep their kit and get the cover glow.
  assert.equal(Object.values(s.blocks).reduce((a, b) => a + b, 0), dataset.buildings.length);
  assert.equal(s.blocks.projectTower, 19);
  assert.equal(s.kitStripCovers, city.stats.future.lightStrips, 'one cover per kit strip pair');
  assert.equal(s.kitEntranceCovers, city.stats.future.nychaEntrances, 'one cover per kit entrance');
  assert.ok(s.trims <= city.stats.neonTrims, 'planned trims sit on cel trims');
  assert.ok(s.skinWalls > 0 && s.strips > 0 && s.canopies > 0 && s.balconies > 0 && s.roofGardens > 0 && s.kerbMetres > 100,
    JSON.stringify(s));

  // Lived-in: the avenues carry the most, the side streets little, civic nothing.
  const planned = (block: FaceliftBlock) => [...facelift.plans.values()].filter((p) => p.block === block);
  const frameShare = (block: FaceliftBlock) => planned(block).filter((p) => p.frames).length / Math.max(1, planned(block).length);
  assert.ok(frameShare('avenue') > frameShare('brownstoneSide'));
  assert.equal(planned('civic').filter((p) => p.frames || p.trim || p.entrance || p.verticalLight).length, 0);
  const lit = [...facelift.plans.values()].filter((p) => p.trim || p.verticalLight).length;
  assert.ok(lit < dataset.buildings.length * 0.5, `${lit} of ${dataset.buildings.length} buildings carry light`);

  // Skin vertices carry a window wall's own attributes: never a lot line or blank stone, never padding.
  const g = facelift.mesh!.geometry;
  const mode = g.getAttribute(FACELIFT_ATTRIBUTE).array as Float32Array;
  const wall = g.getAttribute(FACADE_WALL_ATTRIBUTE).array as Float32Array;
  let skinVerts = 0;
  for (let v = 0; v < mode.length / 2; v++) {
    if (mode[v * 2]! < 0.5) continue;
    skinVerts++;
    assert.ok(wall[v * 4 + 1]! >= 2, 'a wall at least one module wide');
    assert.ok(wall[v * 4 + 3] !== WALL_KINDS.lotLine && wall[v * 4 + 3] !== WALL_KINDS.blankStone);
    assert.equal(mode[v * 2 + 1], 0, 'skin does not glow');
  }
  assert.equal(skinVerts, s.skinWalls * 6);
  assert.equal(g.getAttribute('position').count, s.vertices);

  facelift.dispose();
  assert.equal(city.meshes.find((m) => m.name === 'city:billboards')!.material, billboardsMaterial, 'dispose restores the billboards');
  dispose();
});

test('kit entrance and ring helpers match city-mesh.ts on a stored-clockwise ring', () => {
  // Clockwise storage with the front on stored edge 1 (30 m east wall).
  const building = { id: 'k:1', ring: [0, 0, 0, -20, 30, -20, 30, 0], frontEdgeIndex: 1 };
  const { ring, frontEdge } = ccwRing(building);
  assert.deepEqual(ring[0], [30, 0]);
  assert.equal(frontEdge, 1);
  const door = kitEntrance(building);
  assert.ok(door && door.edge === 1);
  // Edge 1 of the ccw ring is the 30 m wall from (30, -20) to (0, -20); the door stays 4 m clear of each end.
  assert.deepEqual([ring[1], ring[2]], [[30, -20], [0, -20]]);
  assert.ok(Math.abs(door!.at) <= (30 - 8) / 2);
});

test('the materials compile to WGSL with their attributes; the ad sweep holds still under Reduce Motion', async () => {
  const dataset = realTile();
  const { city, clearance, dispose } = physicalCity(dataset);
  const facelift = buildPhysicalFacelift(THREE, dataset, city.meshes, clearance);
  const renderer = await stubRenderer();
  const out = compileWgsl(renderer, facelift.mesh!, facelift.mesh!.material as THREE.Material);
  assert.match(out.vertex, /aFacelift/);
  assert.match(out.vertex, /aFacadeWall/);
  assert.match(out.vertex, /aFacadeGrid/);
  assert.ok(out.fragment.length > 2000);
  const billboards = city.meshes.find((m) => m.name === 'city:billboards')!;
  assert.ok(compileWgsl(renderer, billboards, billboards.material as THREE.Material).fragment.length > 0);

  const ads = createFaceliftAdMaterial(THREE);
  const time = () => {
    let found = NaN;
    (ads.material.colorNode as unknown as THREE.Node).traverse((n: THREE.Node) => {
      const u = n as unknown as { isUniformNode?: boolean; value?: unknown };
      if (u.isUniformNode && typeof u.value === 'number') found = u.value;
    });
    return found;
  };
  ads.update(3, false);
  assert.equal(time(), 3);
  ads.update(9, true);
  assert.equal(time(), 3, 'Reduce Motion freezes the sweep');
  ads.update(12, false);
  assert.equal(time(), 12);
  ads.material.dispose();
  facelift.dispose();
  dispose();
});
